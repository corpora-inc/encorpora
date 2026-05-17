globalThis.process=globalThis.process||{env:{}};(function(){"use strict";let vt=null;const gn=6500,vn=e=>{typeof e=="number"&&Number.isFinite(e)&&e>0&&(vt=e)},yn=()=>{if(typeof navigator>"u")return!0;const e=navigator.userAgent||"";return/iPad/.test(e)?!0:/iPhone|iPod/.test(e)?!1:(/Macintosh/.test(e)&&(navigator.maxTouchPoints??0)>1,!0)},Bt=()=>vt!=null?vt>=gn:yn(),Te=[{id:"tiny_proof",folder:"ggml-tiny.bin",label:"Tiny",shortDesc:"Tiny is, honestly, kind of terrible. You say 'good morning,' Tiny writes 'good warning.' Mostly useful as the baseline you compare bigger models against.",pros:["Tiniest download","Fast on every device","Works offline like everything here"],cons:["Frequently wrong on real sentences","Especially weak on non-Latin scripts"],approxSizeMB:75,defaultForFreshInstall:!0},{id:"small",folder:"ggml-small.bin",label:"Small",shortDesc:"First model that genuinely works for everyday Spanish, French, German, and friends. Boring, reasonable choice for Latin-script languages.",pros:["Solid for most European languages","Modest size and RAM use"],cons:["Less reliable than the Larges","Drifts on harder or longer sentences"],approxSizeMB:465,defaultForFreshInstall:!1},{id:"large_turbo",folder:"ggml-large-v3-turbo-q5_0.bin",label:"Large Turbo q5",shortDesc:"The smallest 'Large.' Whisper's speedy distilled decoder, weights crushed to 5 bits. Snappy on iPhone.",pros:["Smallest of the Large family","Fast on iOS"],cons:["Slow on Android","Distilled decoder is weaker on Telugu / Tamil / other non-Latin scripts"],approxSizeMB:547,defaultForFreshInstall:!1},{id:"large_q8",folder:"ggml-large-v3-turbo-q8_0.bin",label:"Large Turbo q8",shortDesc:"Same Turbo distillation as q5, but at 8-bit precision — math your phone's CPU prefers. Sweet spot for Android.",pros:["~2.5× faster than q5 on Android","Better quality than q5","Solid pick on iOS too"],cons:["Bigger download than q5","Same Turbo weakness on non-Latin scripts"],approxSizeMB:834,defaultForFreshInstall:!1},{id:"large_qlora",folder:"ggml-large-v3-q5_0.bin",label:"Large q5",shortDesc:"Full Whisper Large brain — no Turbo distillation — compressed to 5 bits. Best in our testing for Telugu, Tamil, Bengali, and other non-Latin-script languages.",pros:["Best for Indic and other non-Latin-script languages","Keeps the full 32-layer text decoder","Honest output in the right script"],cons:["~1 GB download","Slower than Turbo on both platforms"],approxSizeMB:1031,defaultForFreshInstall:!1},{id:"medium",folder:"ggml-medium.bin",label:"Full Weight Medium",shortDesc:"Older Whisper architecture at full precision (no compression). Wins occasionally on languages later models quietly got worse at. Usually outdone by Large q5.",pros:["Every weight at native fp16 precision","Occasionally surprises on niche languages"],cons:["Bigger download than Large q5 for usually less quality","Older architecture"],approxSizeMB:1463,defaultForFreshInstall:!1},{id:"large_max",folder:"ggml-large-v3-turbo.bin",label:"Full Weight Large Turbo",shortDesc:"Whisper's speedy Turbo distillation at full 16-bit precision. Hits Metal's fp16 fast path on iPad, so it's quick despite the size.",pros:["Fastest 'Large' on iPad (Metal fp16 fast path)","Top quality for Latin-script languages"],cons:["1.5 GB download","Same Turbo weakness on Indic — Large q5 or q8 is better for those"],approxSizeMB:1549,defaultForFreshInstall:!1},{id:"large_q8_full",folder:"ggml-large-v3-q8_0.bin",label:"Large q8 ★",shortDesc:"The biggest, baddest model that still fits on iPad — full Whisper Large at 8-bit precision (we quantize this one ourselves from the original fp16, since upstream doesn't ship it). Should be the new best for Indic and other non-Latin-script languages.",pros:["Higher precision than Large q5, same full 32-layer decoder","Expected best quality for Telugu, Tamil, Bengali, etc."],cons:["~1.6 GB download","Slower than Turbo and a bit slower than Large q5","Needs ~3 GB RAM headroom during first transcribe (iPad-class only)"],approxSizeMB:1580,defaultForFreshInstall:!1,requiresIpad:!0,downloadUrl:"https://d38iwc9748jekz.cloudfront.net/whisper-models/ggml-large-v3-q8_0.bin"}],yt=()=>Bt()?Te:Te.filter(e=>!e.requiresIpad),bn=()=>{const e=yt();return e.find(t=>t.defaultForFreshInstall)??e[0]},wn=e=>!!e.requiresIpad&&!Bt(),Se=e=>{if(e)return Te.find(t=>t.id===e)},Dt=()=>Te.find(e=>e.defaultForFreshInstall)??Te[0],Ae={temperature:0,temperature_inc:.2,entropy_thold:2.4,logprob_thold:-1,no_speech_thold:.6,suppress_blank:!0,suppress_nst:!1,n_threads:0,initial_prompt:""},Je={te:{temperature_inc:0,initial_prompt:"నేను తెలుగు నేర్చుకుంటున్నాను. నేను ఒక పదబంధం ప్రయత్నిస్తాను, మీరు విన్నది నిజాయితీగా చెప్పండి."},ta:{temperature_inc:0,initial_prompt:"நான் தமிழ் கற்றுக்கொள்கிறேன். ஒரு சொற்றொடரை முயற்சிக்கப் போகிறேன், நீங்கள் கேட்டதை நேர்மையாகச் சொல்லுங்கள்."},ml:{temperature_inc:0,initial_prompt:"ഞാൻ മലയാളം പഠിക്കുകയാണ്. ഞാൻ ഒരു വാക്യം പറയാൻ പോകുന്നു, നിങ്ങൾ കേട്ടത് സത്യസന്ധമായി പറയൂ."},bn:{temperature_inc:0,initial_prompt:"আমি বাংলা শিখছি। আমি একটি বাক্যাংশ চেষ্টা করব, আপনি যা শুনেছেন তা সততার সাথে বলুন।"},mr:{temperature_inc:0,initial_prompt:"मी मराठी शिकत आहे. मी एक वाक्यांश प्रयत्न करणार आहे, तुम्ही ऐकलेले प्रामाणिकपणे सांगा."},gu:{temperature_inc:0,initial_prompt:"હું ગુજરાતી શીખું છું. હું એક વાક્ય બોલવાનો છું, તમે જે સાંભળ્યું તે પ્રામાણિકતાથી કહો."},pa:{temperature_inc:0,initial_prompt:"ਮੈਂ ਪੰਜਾਬੀ ਸਿੱਖ ਰਿਹਾ ਹਾਂ। ਮੈਂ ਇੱਕ ਵਾਕੰਸ਼ ਅਜ਼ਮਾਉਣ ਜਾ ਰਿਹਾ ਹਾਂ, ਤੁਸੀਂ ਜੋ ਸੁਣਿਆ ਉਹ ਇਮਾਨਦਾਰੀ ਨਾਲ ਦੱਸੋ।"},or:{temperature_inc:0,initial_prompt:"ମୁଁ ଓଡ଼ିଆ ଶିଖୁଛି। ମୁଁ ଗୋଟିଏ ଶବ୍ଦଗୁଚ୍ଛ ଚେଷ୍ଟା କରିବି, ଆପଣ ଯାହା ଶୁଣିଲେ ସତ୍ୟ ଭାବରେ କୁହନ୍ତୁ।"},as:{temperature_inc:0,initial_prompt:"মই অসমীয়া শিকি আছোঁ। মই এটা বাক্যাংশ চেষ্টা কৰিম, আপুনি যি শুনিলে সেইটো সত্যনিষ্ঠভাৱে কওক।"},ne:{temperature_inc:0,initial_prompt:"म नेपाली सिक्दैछु। म एउटा वाक्यांश प्रयास गर्ने छु, तपाईंले सुनेको कुरा इमानदारीपूर्वक भन्नुहोस्।"},si:{temperature_inc:0,initial_prompt:"මම සිංහල ඉගෙන ගන්නවා. මම වාක්‍ය ඛණ්ඩයක් උත්සාහ කරන්නම්, ඔබ ඇසූදේ අවංකව කියන්න."},fa:{temperature_inc:0,initial_prompt:"من فارسی یاد می‌گیرم. می‌خواهم یک عبارت بگویم، آنچه شنیدید را صادقانه بگویید."},ur:{temperature_inc:0,initial_prompt:"میں اردو سیکھ رہا ہوں۔ میں ایک جملہ بولنے جا رہا ہوں، جو آپ نے سنا اسے دیانتداری سے بتائیں۔"}},Ft="pc:whisper-tuning",Me=()=>{try{const e=localStorage.getItem(Ft);if(!e)return{};const t=JSON.parse(e);return!t||typeof t!="object"?{}:t}catch(e){return console.error("[whisperTuning] loadUserOverrides failed:",e),{}}},bt=e=>{try{localStorage.setItem(Ft,JSON.stringify(e))}catch(t){console.error("[whisperTuning] saveUserOverrides failed:",t)}},wt=(e,t)=>{const r=Me(),n=e.split("-")[0].toLowerCase(),o={...r[n]??{},...t};for(const c of Object.keys(o))o[c]===void 0&&delete o[c];Object.keys(o).length===0?delete r[n]:r[n]=o,bt(r)},Sn=e=>{const t=Me(),r=e.split("-")[0].toLowerCase();delete t[r],bt(t)},$n=()=>{bt({})},Wt=e=>{const t=e.split("-")[0].toLowerCase(),r=Je[t]??{},n=Me()[t]??{};return{...r,...n}},Ln={},Ut=e=>{const t=e.split("-")[0].toLowerCase();return Ln[t]??{}},Ze=[{key:"temperature_inc",label:"temperature_inc",min:0,max:.5,step:.05,help:"Step for the fallback ladder (0.0 → 0.2 → 0.4 → … → 1.0). 0.0 disables retries entirely — one greedy decode, deterministic."},{key:"temperature",label:"temperature",min:0,max:1.5,step:.05,help:"Initial decoding temperature. 0.0 = greedy. Raise to sample from the start (almost never want for transcription)."},{key:"entropy_thold",label:"entropy_thold",min:0,max:10,step:.1,help:"Compression-ratio-style quality gate. Higher = more permissive. Indic BPE routinely exceeds 2.4 default."},{key:"logprob_thold",label:"logprob_thold",min:-5,max:0,step:.1,help:"Avg per-token log-prob below which the decode is flagged unconfident and the fallback fires."},{key:"no_speech_thold",label:"no_speech_thold",min:0,max:1,step:.05,help:"Whisper's posterior threshold for 'this segment is silence.' Above this, the segment emits nothing."},{key:"n_threads",label:"n_threads",min:0,max:12,step:1,help:"CPU thread count. 0 = let the plugin decide (cores − 2). Higher uses more battery; lower can free the UI thread."}],et=[{key:"suppress_blank",label:"suppress_blank",help:"Suppress blank tokens at the start of a segment."},{key:"suppress_nst",label:"suppress_nst",help:"Suppress non-speech tokens (music, noise markers). False by default."}],tt=[{key:"initial_prompt",label:"initial_prompt",placeholder:"(empty)",help:"Up to ~224 tokens prepended before decoding. Bias toward a script/language; do NOT leak the expected phrase (model will parrot it). Native-script primer recommended for Indic langs."}],kn=e=>e.split("-")[0].toLowerCase(),Le=(e,t)=>t>=1?String(Math.round(e)):t>=.1?e.toFixed(1):e.toFixed(2),De=e=>e.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;");let ce=null,ue="";const xn=e=>{var s,o,c,d,m;ce&&Fe(),ue=kn(e);const t=document.createElement("div");t.className="pc-tuner-root",t.innerHTML=Tn(ue),document.body.appendChild(t),requestAnimationFrame(()=>{t.classList.add("open")}),(s=t.querySelector("[data-pc-tuner-backdrop]"))==null||s.addEventListener("click",Fe),(o=t.querySelector("[data-pc-tuner-close]"))==null||o.addEventListener("click",Fe);const r=t.querySelector("[data-pc-tuner-handle]"),n=t.querySelector(".pc-tuner-sheet");if(r&&n){let g=0,S=0,$=!1;const f=6;r.addEventListener("pointerdown",p=>{$=!0,g=p.clientY,S=Date.now(),r.setPointerCapture(p.pointerId),n.style.transition="none"}),r.addEventListener("pointermove",p=>{if(!$)return;const k=Math.max(0,p.clientY-g);n.style.transform=`translateY(${k}px)`});const y=(p,k)=>{if(!$)return;$=!1;try{r.releasePointerCapture(p.pointerId)}catch{}const Z=p.clientY-g,ee=Date.now()-S,L=ee>0?Z/ee:0,W=n.offsetHeight*.15,w=k&&(Z>W||L>.5&&Z>20||Math.abs(Z)<f);n.style.transition="",n.style.transform="",w&&Fe()};r.addEventListener("pointerup",p=>y(p,!0)),r.addEventListener("pointercancel",p=>y(p,!1))}t.addEventListener("keydown",g=>{g.key==="Escape"&&Fe()});for(const g of Ze)Cn(t,g);for(const g of et)qn(t,g);for(const g of tt)Rn(t,g);(c=t.querySelector("[data-pc-tuner-copy]"))==null||c.addEventListener("click",In),(d=t.querySelector("[data-pc-tuner-reset-lang]"))==null||d.addEventListener("click",Pn),(m=t.querySelector("[data-pc-tuner-reset-all]"))==null||m.addEventListener("click",An),ce=t},Fe=()=>{if(!ce)return;const e=ce;ce=null,e.classList.remove("open"),window.setTimeout(()=>{e.parentNode&&e.parentNode.removeChild(e)},240)},Tn=e=>{const t=Je[e]??{},r=Me()[e]??{},n=Ze.map(c=>Mn(c,t,r)).join(""),s=et.map(c=>En(c,t,r)).join(""),o=tt.map(c=>_n(c,t,r)).join("");return`
    <div class="pc-tuner-backdrop" data-pc-tuner-backdrop></div>
    <div class="pc-tuner-sheet" role="dialog" aria-label="Whisper tuning">
      <div class="pc-tuner-handle" data-pc-tuner-handle
           role="button" aria-label="Close tuner" tabindex="0">
        <div class="pc-tuner-handle-bar"></div>
      </div>
      <header class="pc-tuner-head">
        <div class="pc-tuner-title">
          <span class="pc-tuner-eyebrow">whisper tuning</span>
          <span class="pc-tuner-lang">${De(e.toUpperCase())}</span>
        </div>
        <button class="pc-tuner-close" data-pc-tuner-close
                aria-label="Close tuner">×</button>
      </header>
      <div class="pc-tuner-body">
        <div class="pc-tuner-section">
          <h3 class="pc-tuner-section-title">Initial prompt</h3>
          ${o}
        </div>
        <div class="pc-tuner-section">
          <h3 class="pc-tuner-section-title">Decoder gates</h3>
          ${n}
        </div>
        <div class="pc-tuner-section">
          <h3 class="pc-tuner-section-title">Toggles</h3>
          ${s}
        </div>
      </div>
      <footer class="pc-tuner-foot">
        <button class="pc-tuner-btn" data-pc-tuner-copy>Copy as JSON</button>
        <button class="pc-tuner-btn" data-pc-tuner-reset-lang>Reset this lang</button>
        <button class="pc-tuner-btn danger" data-pc-tuner-reset-all>Reset all</button>
        <button class="pc-tuner-btn primary" data-pc-tuner-close>Done</button>
      </footer>
    </div>
  `},Mn=(e,t,r)=>{const n=Ae[e.key]??0,s=t[e.key],o=r[e.key],c=o!==void 0?o:s!==void 0?s:n,d=o!==void 0&&o!==n,m=[];return m.push(`<span>default <b>${Le(n,e.step)}</b></span>`),s!==void 0&&m.push(`<span>built-in <b>${Le(s,e.step)}</b></span>`),d&&m.push('<span class="pc-tuner-modified">modified</span>'),`
    <div class="pc-tuner-row" data-pc-row="${e.key}">
      <div class="pc-tuner-row-head">
        <label class="pc-tuner-row-label" for="pc-tuner-input-${e.key}">
          ${e.label}
        </label>
        <input type="number"
               id="pc-tuner-input-${e.key}"
               class="pc-tuner-num"
               step="${e.step}"
               min="${e.min}"
               max="${e.max}"
               value="${Le(c,e.step)}"
               data-pc-tuner-num="${e.key}" />
      </div>
      <input type="range"
             class="pc-tuner-slider"
             step="${e.step}"
             min="${e.min}"
             max="${e.max}"
             value="${c}"
             data-pc-tuner-slider="${e.key}"
             aria-label="${e.label}" />
      <div class="pc-tuner-row-trail">
        ${m.join('<span class="pc-tuner-sep">·</span>')}
      </div>
      <p class="pc-tuner-help">${e.help}</p>
    </div>
  `},En=(e,t,r)=>{const n=Ae[e.key],s=t[e.key],o=r[e.key],c=o!==void 0?o:s!==void 0?s:n,d=o!==void 0&&o!==n;return`
    <div class="pc-tuner-row pc-tuner-row-bool" data-pc-row="${e.key}">
      <div class="pc-tuner-row-head">
        <label class="pc-tuner-row-label">
          ${e.label}
        </label>
        <label class="pc-tuner-switch">
          <input type="checkbox"
                 ${c?"checked":""}
                 data-pc-tuner-bool="${e.key}" />
          <span class="pc-tuner-switch-slider"></span>
        </label>
      </div>
      <div class="pc-tuner-row-trail">
        <span>default <b>${n?"on":"off"}</b></span>
        ${s!==void 0?`<span class="pc-tuner-sep">·</span>
               <span>built-in <b>${s?"on":"off"}</b></span>`:""}
        ${d?`<span class="pc-tuner-sep">·</span>
               <span class="pc-tuner-modified">modified</span>`:""}
      </div>
      <p class="pc-tuner-help">${e.help}</p>
    </div>
  `},_n=(e,t,r)=>{const n=t[e.key],s=r[e.key],o=s!==void 0?s:n!==void 0?n:"",c=s!==void 0&&s!==(n??""),d=[];return n&&n.length>0?d.push(`<span>built-in <b>"${De(n)}"</b></span>`):d.push("<span>default <b>(empty)</b></span>"),c&&d.push('<span class="pc-tuner-modified">modified</span>'),`
    <div class="pc-tuner-row pc-tuner-row-text" data-pc-row="${e.key}">
      <div class="pc-tuner-row-head">
        <label class="pc-tuner-row-label" for="pc-tuner-text-${e.key}">
          ${e.label}
        </label>
      </div>
      <textarea id="pc-tuner-text-${e.key}"
                class="pc-tuner-text"
                rows="2"
                placeholder="${De(e.placeholder)}"
                data-pc-tuner-text="${e.key}"
                spellcheck="false"
                autocapitalize="off"
                autocorrect="off">${De(o)}</textarea>
      <div class="pc-tuner-row-trail">
        ${d.join('<span class="pc-tuner-sep">·</span>')}
      </div>
      <p class="pc-tuner-help">${e.help}</p>
    </div>
  `},Cn=(e,t)=>{const r=e.querySelector(`[data-pc-tuner-slider="${t.key}"]`),n=e.querySelector(`[data-pc-tuner-num="${t.key}"]`);if(!r||!n)return;const s=o=>{const c=parseFloat(o);if(Number.isNaN(c))return;const d=Math.min(t.max,Math.max(t.min,c));wt(ue,{[t.key]:d}),r.value=String(d),n.value=Le(d,t.step),Oe(e,t.key)};r.addEventListener("input",()=>{n.value=Le(parseFloat(r.value),t.step)}),r.addEventListener("change",()=>s(r.value)),n.addEventListener("change",()=>s(n.value))},qn=(e,t)=>{const r=e.querySelector(`[data-pc-tuner-bool="${t.key}"]`);r&&r.addEventListener("change",()=>{wt(ue,{[t.key]:r.checked}),Oe(e,t.key)})},Rn=(e,t)=>{const r=e.querySelector(`[data-pc-tuner-text="${t.key}"]`);if(!r)return;const n=()=>{const s=r.value;wt(ue,{[t.key]:s.length>0?s:void 0}),Oe(e,t.key)};r.addEventListener("blur",n),r.addEventListener("keydown",s=>{s.key==="Enter"&&!(s.metaKey||s.ctrlKey||s.shiftKey)&&(s.preventDefault(),r.blur())})},Oe=(e,t)=>{const r=Je[ue]??{},n=Me()[ue]??{},s=e.querySelector(`[data-pc-row="${t}"]`);if(!s)return;const o=s.querySelector(".pc-tuner-row-trail");if(!o)return;const c=Ze.find(g=>g.key===t);if(c){const g=Ae[t]??0,S=r[t],$=n[t],f=$!==void 0&&$!==g,y=[`<span>default <b>${Le(g,c.step)}</b></span>`];S!==void 0&&y.push(`<span>built-in <b>${Le(S,c.step)}</b></span>`),f&&y.push('<span class="pc-tuner-modified">modified</span>'),o.innerHTML=y.join('<span class="pc-tuner-sep">·</span>');return}if(et.find(g=>g.key===t)){const g=Ae[t],S=r[t],$=n[t],f=$!==void 0&&$!==g,y=[`<span>default <b>${g?"on":"off"}</b></span>`];S!==void 0&&y.push(`<span>built-in <b>${S?"on":"off"}</b></span>`),f&&y.push('<span class="pc-tuner-modified">modified</span>'),o.innerHTML=y.join('<span class="pc-tuner-sep">·</span>');return}if(tt.find(g=>g.key===t)){const g=r[t],S=n[t],$=S!==void 0&&S!==(g??""),f=[];g&&g.length>0?f.push(`<span>built-in <b>"${De(g)}"</b></span>`):f.push("<span>default <b>(empty)</b></span>"),$&&f.push('<span class="pc-tuner-modified">modified</span>'),o.innerHTML=f.join('<span class="pc-tuner-sep">·</span>')}},In=async()=>{var t;const e=JSON.stringify(Me(),null,2);try{await((t=navigator.clipboard)==null?void 0:t.writeText(e)),nt(`Copied (${e.length} chars)`)}catch(r){console.error("[whisperTunerUI] clipboard write failed:",r),nt("Copy failed — see console")}},jt=e=>{const t=Je[ue]??{},r=Me()[ue]??{};for(const n of Ze){const s=Ae[n.key]??0,o=r[n.key]!==void 0?r[n.key]:t[n.key]!==void 0?t[n.key]:s,c=e.querySelector(`[data-pc-tuner-slider="${n.key}"]`),d=e.querySelector(`[data-pc-tuner-num="${n.key}"]`);c&&(c.value=String(o)),d&&(d.value=Le(o,n.step)),Oe(e,n.key)}for(const n of et){const s=Ae[n.key],o=r[n.key]!==void 0?r[n.key]:t[n.key]!==void 0?t[n.key]:s,c=e.querySelector(`[data-pc-tuner-bool="${n.key}"]`);c&&(c.checked=o),Oe(e,n.key)}for(const n of tt){const s=r[n.key]!==void 0?r[n.key]:t[n.key]!==void 0?t[n.key]:"",o=e.querySelector(`[data-pc-tuner-text="${n.key}"]`);o&&(o.value=s),Oe(e,n.key)}},Pn=()=>{ce&&(Sn(ue),jt(ce),nt("Reset to built-in"))},An=()=>{ce&&($n(),jt(ce),nt("All languages reset"))},nt=e=>{if(!ce)return;const t=ce.querySelector(".pc-tuner-foot");if(!t)return;const r=document.createElement("div");r.className="pc-tuner-flash",r.textContent=e,t.appendChild(r),window.setTimeout(()=>{r.parentNode&&r.parentNode.removeChild(r)},1600)},On={rmsThreshold:.012,speechStartMs:120,silenceMs:1500,leadInMs:250},Gt=(e,t,r)=>{const n={...On,...t};let s=!1,o=null,c=null,d=null,m=null,g=!1,S=!1;try{S=localStorage.getItem("pc:silence-debug")==="1"}catch{}const $=()=>{if(s)return;s=!0;const p=o;if(o=null,p)try{p()}catch(k){console.error("[silence-watcher] unsubscribe threw:",k)}},f=()=>{if(!s){$();try{r()}catch(p){console.error("[silence-watcher] onSilence threw:",p)}}},y=p=>{if(s||(g||(g=!0,console.log(`[silence-watcher] first audio_level event: rms=${p.rms.toFixed(4)} t=${p.t}ms (policy: rmsThreshold=${n.rmsThreshold}, speechStartMs=${n.speechStartMs}, silenceMs=${n.silenceMs}, leadInMs=${n.leadInMs})`)),S&&console.log(`[silence-watcher] rms=${p.rms.toFixed(4)} t=${p.t}ms state=${d===null?"waiting":"speaking"}`),p.t<n.leadInMs))return;const k=p.rms>=n.rmsThreshold;if(d===null){k?(c===null&&(c=p.t),p.t-c>=n.speechStartMs&&(d=p.t,m=null,console.log(`[silence-watcher] speech detected at t=${p.t}ms rms=${p.rms.toFixed(4)}`))):c=null;return}if(k){m=null;return}m===null&&(m=p.t),p.t-m>=n.silenceMs&&(console.log(`[silence-watcher] auto-stop at t=${p.t}ms (quiet for ${p.t-m}ms after speech)`),f())};return console.log("[silence-watcher] subscribing to audio_level…"),e(y).then(p=>{if(console.log("[silence-watcher] subscribed; waiting for first event"),s){try{p()}catch(k){console.error("[silence-watcher] late unsubscribe threw:",k)}return}o=p}).catch(p=>{console.warn("[silence-watcher] subscribe failed; auto-stop disabled:",(p==null?void 0:p.message)||p)}),{stop:$}},St=e=>{if(e&&typeof e=="object"){const t=e.code;if(typeof t=="string")return t}},me=e=>{if(e==null)return"(unknown error)";if(typeof e=="string")return e;if(e instanceof Error)return e.message||e.name||String(e);if(typeof e=="object"){const t=e,r=[t.message,t.localizedDescription,t.error,t.description,t.detail];for(const n of r)if(typeof n=="string"&&n.length>0)return n;try{const n=JSON.stringify(e);if(n&&n!=="{}")return n}catch{}}return String(e)},Nn=70,zn=.4,$t="corpan-pronunciation-coach:v2",Yt="corpan-pronunciation-coach:v1",Hn=50,ke=e=>{var t;return((t=Se(e))==null?void 0:t.folder)??e},re=e=>{var t;return((t=Se(e))==null?void 0:t.label)??e},Bn=e=>{const t=Se(e);return t&&t.approxSizeMB>=1e3?18e4:6e4},Dn=9e4,Kt=async(e,t,r)=>{let n=null;const s=new Promise((o,c)=>{n=setTimeout(()=>{c(new Error(`${r} timed out after ${Math.round(t/1e3)}s`))},t)});try{return await Promise.race([e,s])}finally{n&&clearTimeout(n)}},Fn=e=>{var t,r,n;return{entryId:e.entry.entry_id,level:e.entry.level,domains:e.entry.domains??[],targetLang:e.targetLang,targetText:e.target.text,targetRoman:e.target.romanization??"",nativeLang:((t=e.native)==null?void 0:t.language_code)??null,nativeText:((r=e.native)==null?void 0:r.text)??"",nativeRoman:((n=e.native)==null?void 0:n.romanization)??""}},Wn=e=>({entry:{entry_id:e.entryId,level:e.level,domains:e.domains,translations:[]},target:{language_code:e.targetLang,text:e.targetText,romanization:e.targetRoman},native:e.nativeLang?{language_code:e.nativeLang,text:e.nativeText,romanization:e.nativeRoman}:null,targetLang:e.targetLang}),Vt=/[''']/,Un={en:{zero:"0",one:"1",two:"2",three:"3",four:"4",five:"5",six:"6",seven:"7",eight:"8",nine:"9",ten:"10",eleven:"11",twelve:"12",thirteen:"13",fourteen:"14",fifteen:"15",sixteen:"16",seventeen:"17",eighteen:"18",nineteen:"19",twenty:"20",thirty:"30",forty:"40",fifty:"50",sixty:"60",seventy:"70",eighty:"80",ninety:"90",hundred:"100",thousand:"1000"},es:{cero:"0",uno:"1",una:"1",dos:"2",tres:"3",cuatro:"4",cinco:"5",seis:"6",siete:"7",ocho:"8",nueve:"9",diez:"10",once:"11",doce:"12",trece:"13",catorce:"14",quince:"15",dieciséis:"16",dieciseis:"16",diecisiete:"17",dieciocho:"18",diecinueve:"19",veinte:"20",treinta:"30",cuarenta:"40",cincuenta:"50",sesenta:"60",setenta:"70",ochenta:"80",noventa:"90",cien:"100",ciento:"100",mil:"1000"},fr:{zéro:"0",zero:"0",un:"1",une:"1",deux:"2",trois:"3",quatre:"4",cinq:"5",six:"6",sept:"7",huit:"8",neuf:"9",dix:"10",onze:"11",douze:"12",treize:"13",quatorze:"14",quinze:"15",seize:"16",vingt:"20",trente:"30",quarante:"40",cinquante:"50",soixante:"60",cent:"100",mille:"1000"},it:{zero:"0",uno:"1",una:"1",due:"2",tre:"3",quattro:"4",cinque:"5",sei:"6",sette:"7",otto:"8",nove:"9",dieci:"10",undici:"11",dodici:"12",tredici:"13",quattordici:"14",quindici:"15",sedici:"16",diciassette:"17",diciotto:"18",diciannove:"19",venti:"20",trenta:"30",quaranta:"40",cinquanta:"50",sessanta:"60",settanta:"70",ottanta:"80",novanta:"90",cento:"100",mille:"1000"},de:{null:"0",eins:"1",ein:"1",eine:"1",zwei:"2",drei:"3",vier:"4",fünf:"5",funf:"5",sechs:"6",sieben:"7",acht:"8",neun:"9",zehn:"10",elf:"11",zwölf:"12",zwolf:"12",dreizehn:"13",vierzehn:"14",fünfzehn:"15",funfzehn:"15",sechzehn:"16",siebzehn:"17",achtzehn:"18",neunzehn:"19",zwanzig:"20",dreißig:"30",dreissig:"30",vierzig:"40",fünfzig:"50",funfzig:"50",sechzig:"60",siebzig:"70",achtzig:"80",neunzig:"90",hundert:"100",tausend:"1000"},pt:{zero:"0",um:"1",uma:"1",dois:"2",duas:"2",três:"3",tres:"3",quatro:"4",cinco:"5",seis:"6",sete:"7",oito:"8",nove:"9",dez:"10",onze:"11",doze:"12",treze:"13",catorze:"14",quatorze:"14",quinze:"15",dezesseis:"16",dezasseis:"16",dezessete:"17",dezassete:"17",dezoito:"18",dezenove:"19",dezanove:"19",vinte:"20",trinta:"30",quarenta:"40",cinquenta:"50",sessenta:"60",setenta:"70",oitenta:"80",noventa:"90",cem:"100",cento:"100",mil:"1000"}},jn=new Set(["te","ta","bn","ml","mr","gu","pa","ur","fa","si","ne","or","as"]),xe=(e,t)=>{const r=e.normalize("NFC").toLowerCase().replace(/[\p{P}\p{S}\p{C}]/gu,"").replace(/\s+/g," ").trim();if(!r)return r;const n=(t??"").toLowerCase().split("-")[0],s=Un[n];return s?r.split(" ").map(o=>s[o]??o).join(" "):r},Gn=/[぀-ゟ゠-ヿ㐀-䶿一-鿿豈-﫿가-힯]/,rt=e=>{const t=e.trim();if(!t)return[];if(/\s/.test(t))return t.split(/\s+/).filter(Boolean);if(Gn.test(t)){const r=Intl.Segmenter;if(typeof r=="function"){const n=new r(void 0,{granularity:"grapheme"});return Array.from(n.segment(t),s=>s.segment).filter(s=>s.trim().length>0)}return Array.from(t).filter(n=>n.trim().length>0)}return[t]},at=(e,t)=>{const r=Array.from(e),n=Array.from(t),s=r.length,o=n.length;if(s===0&&o===0)return 1;if(s===0||o===0)return 0;let c=new Array(o+1),d=new Array(o+1);for(let m=0;m<=o;m++)c[m]=m;for(let m=1;m<=s;m++){d[0]=m;for(let S=1;S<=o;S++)d[S]=r[m-1]===n[S-1]?c[S-1]:1+Math.min(c[S],d[S-1],c[S-1]);const g=c;c=d,d=g}return 1-c[o]/Math.max(s,o)},Xt=e=>{if(!e||e.length===0)return[];const t=[];for(const r of e){const n=t[t.length-1];if(n){const s=n.word.replace(/\s+$/,"").slice(-1),o=r.word.replace(/^\s+/,"").charAt(0),c=Vt.test(s),d=Vt.test(o);if(c||d){n.word=n.word+r.word.replace(/^\s+/,""),n.endMs=Math.max(n.endMs,r.endMs),n.probability=Math.min(n.probability,r.probability);continue}}t.push({...r})}return t},Yn=()=>{try{const e=window.localStorage,t="__pc_probe__";return e.setItem(t,"1"),e.removeItem(t),e}catch{return null}},Qt=e=>{if(!e)return null;try{const t=JSON.parse(e);return typeof t!="object"||t===null||!Array.isArray(t.phrases)||typeof t.idx!="number"||typeof t.streak!="number"?null:t}catch(t){return console.error("[pronunciation-coach] localStorage parse failed:",t),null}},Jt=e=>{if(!e)return null;const t=Qt(e.getItem($t));if(t)return t;const r=Qt(e.getItem(Yt));if(!r)return null;const n={...r,mode:r.mode==="standard"?"standard":void 0};try{e.setItem($t,JSON.stringify(n)),e.removeItem(Yt),console.log("[pronunciation-coach] migrated v1 → v2 storage, mode preserved:",n.mode??"(cleared)")}catch(s){console.error("[pronunciation-coach] storage migration failed:",s)}return n},Kn=()=>{try{const e=globalThis.crypto;if(e&&typeof e.randomUUID=="function")return e.randomUUID()}catch(e){console.error("[pronunciation-coach] randomUUID failed:",e)}return`pc-${Date.now()}-${Math.floor(Math.random()*1e9)}`},Zt=e=>e?e.split("-")[0].toLowerCase():"en",Vn=e=>{const t=[...e];for(let r=t.length-1;r>0;r--){const n=Math.floor(Math.random()*(r+1));[t[r],t[n]]=[t[n],t[r]]}return t},Xn=(e,t)=>{const r=t.length>0?e.translations.find(o=>o.language_code===t[0])??null:null;let n=null;const s=Vn(t.slice(1));for(const o of s){const c=e.translations.find(d=>d.language_code===o);if(c){n=c;break}}return n||(n=e.translations.find(o=>!r||o.language_code!==r.language_code)??null),{target:n,native:r}},Q=e=>e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"),ot=()=>{try{window.dispatchEvent(new CustomEvent("corpan:exit"))}catch(e){console.error("[pronunciation-coach] dispatch exit failed:",e)}},Qn=e=>{const t=document.createElement("div");t.className="pc-confetti";const r=["#7c3aed","#16a34a","#facc15","#ec4899","#06b6d4"],n=32;for(let s=0;s<n;s++){const o=document.createElement("span");o.style.left=`${Math.random()*100}%`,o.style.background=r[s%r.length],o.style.animationDelay=`${Math.random()*200}ms`,o.style.animationDuration=`${900+Math.random()*600}ms`,o.style.transform=`rotate(${Math.random()*360}deg)`,t.appendChild(o)}e.appendChild(t),window.setTimeout(()=>t.remove(),1800)},Jn=(e,t,r)=>{const n=t.stt;let s=!1,o=null,c=null;const d=()=>{c&&(c.stop(),c=null)},m=document.querySelector('meta[name="viewport"]'),g=(m==null?void 0:m.getAttribute("content"))??null;m&&m.setAttribute("content","width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover");const S=()=>{m&&g!==null&&m.setAttribute("content",g)},$=(a="Speech recognition isn't available on this device",i="Parlometron needs the on-device Whisper plugin and didn't find a working one here. Try updating the app, or this platform may not be supported yet.")=>{var l;e.innerHTML=`
      <div class="pc-root">
        <div class="pc-header">
          <div class="pc-header-left"></div>
          <div class="pc-header-right">
            <button class="pc-close" id="pc-close" type="button" aria-label="Close">×</button>
          </div>
        </div>
        <div class="pc-unavailable">
          <h2>${Q(a)}</h2>
          <p>${Q(i)}</p>
        </div>
      </div>
    `,(l=e.querySelector("#pc-close"))==null||l.addEventListener("click",ot)};if(!n)return $(),{unmount:()=>{S(),e.innerHTML=""}};e.innerHTML=`
    <div class="pc-backdrop" id="pc-backdrop"></div>

    <div class="pc-root" id="pc-root">
      <div class="pc-header">
        <div class="pc-header-left">
          <button class="pc-back" id="pc-close" type="button"
                  aria-label="Back to Parlometron picker">‹</button>
        </div>
        <button class="pc-lang-badge" id="pc-lang-badge"
                type="button"
                data-pc-lang-badge
                data-pc-lang=""
                aria-label="Target language (long-press to tune Whisper)"
                hidden>—</button>
        <div class="pc-header-right">
          <span class="pc-streak" id="pc-streak" hidden>🔥 <span id="pc-streak-n">0</span></span>
          <button class="pc-mode" id="pc-mode" type="button"
                  aria-pressed="false"
                  aria-label="Switch speech model"
                  title="Speech model">
            <span class="pc-mode-glyph" aria-hidden="true">✦</span>
          </button>
        </div>
      </div>

      <div class="pc-swipe-area" id="pc-swipe-area">
        <div class="pc-deck" id="pc-deck">
          <div class="pc-card" id="pc-card">
            <div class="pc-card-above">
              <div class="pc-result-banner" data-pc-result-banner hidden></div>
              <div class="pc-result-transcript-up" data-pc-result-transcript-up hidden></div>
              <div class="pc-result-bars-up" data-pc-result-bars-up hidden></div>
            </div>
            <div class="pc-card-center">
              <h1 class="pc-target" id="pc-target">Loading…</h1>
              <p class="pc-romanization" id="pc-romanization" hidden></p>
              <p class="pc-native" id="pc-native"></p>
            </div>
            <div class="pc-card-below">
              <div class="pc-result-detail" data-pc-result-detail hidden></div>
            </div>
          </div>
        </div>
      </div>

      <div class="pc-stage">
        <div class="pc-mic-wrap">
          <button class="pc-mic" id="pc-mic" type="button" disabled>
            <span id="pc-mic-icon">●</span>
          </button>
          <div class="pc-mic-label" id="pc-mic-label">Loading model…</div>
          <div class="pc-swipe-hint">← swipe to navigate →</div>
        </div>
        <div class="pc-error" id="pc-error" hidden></div>
      </div>

      <div class="pc-footer">
        Powered by WhisperKit · <span id="pc-footer-model">Standard</span> · on-device, iOS
      </div>
    </div>
  `;const f=e.querySelector("#pc-close"),y=e.querySelector("#pc-streak"),p=e.querySelector("#pc-streak-n"),k=e.querySelector("#pc-mode"),Z=e.querySelector("#pc-swipe-area"),ee=e.querySelector("#pc-deck");let L=e.querySelector("#pc-card");const W=e.querySelector("#pc-mic"),w=e.querySelector("#pc-mic-icon"),b=e.querySelector("#pc-mic-label"),R=a=>a.querySelector("[data-pc-result-banner]"),N=a=>a.querySelector("[data-pc-result-transcript-up]"),U=a=>a.querySelector("[data-pc-result-bars-up]"),I=a=>a.querySelector("[data-pc-result-detail]"),j=e.querySelector("#pc-error");let H=null;const ne=a=>{H||(H=document.createElement("div"),H.className="pc-overlay",H.innerHTML='<div class="pc-spinner"></div><div id="pc-overlay-msg"></div>',document.body.appendChild(H));const i=H.querySelector("#pc-overlay-msg");i&&(i.textContent=a)},te=()=>{H&&H.parentNode&&H.parentNode.removeChild(H),H=null},A=a=>{j.textContent=a,j.hidden=!1,console.error("[pronunciation-coach]",a)},le=()=>{j.textContent="",j.hidden=!0};let G="idle",F=!1,E=null;const J=[];let K=-1,fe=null,V=0,P=Dt().id,de=!1;const Ne=Yn(),he=()=>{if(Ne)try{const a=Math.max(0,J.length-Hn),i=J.slice(a).map(Fn),l=K-a,h={streak:V,phrases:i,idx:l,mode:P};Ne.setItem($t,JSON.stringify(h))}catch(a){console.error("[pronunciation-coach] persist failed:",a)}},_e=()=>{const a=Se(P);k.setAttribute("aria-pressed",P==="advanced"?"true":"false"),k.classList.toggle("advanced",P==="advanced"),k.disabled=de;const i=a?`${a.label} model (~${a.approxSizeMB} MB) · tap to switch`:`${re(P)} model · tap to switch`;k.title=i,k.setAttribute("aria-label",`Speech model: ${re(P)}`);const l=e.querySelector("#pc-footer-model");l&&(l.textContent=re(P))},z=()=>{V<=0?y.hidden=!0:(p.textContent=String(V),y.hidden=!1)},M=a=>{G=a,W.classList.remove("recording","scoring"),W.disabled=!1,a==="idle"?(w.innerHTML="●",b.textContent=F?"Tap to speak":"Loading model…",W.disabled=!F||!E):a==="recording"?(W.classList.add("recording"),w.innerHTML="■",b.textContent="Listening… tap to stop"):a==="scoring"&&(W.classList.add("scoring"),w.innerHTML='<div class="pc-spinner"></div>',b.textContent="Scoring…",W.disabled=!0)},se=(a,i,l)=>`
    <div class="pc-card-above">
      <div class="pc-result-banner" data-pc-result-banner hidden></div>
      <div class="pc-result-transcript-up" data-pc-result-transcript-up hidden></div>
      <div class="pc-result-bars-up" data-pc-result-bars-up hidden></div>
    </div>
    <div class="pc-card-center">
      ${a}
      ${i}
      ${l}
    </div>
    <div class="pc-card-below">
      <div class="pc-result-detail" data-pc-result-detail hidden></div>
    </div>
  `,ge=e.querySelector("#pc-lang-badge"),je=a=>{if(!a){ge.hidden=!0,ge.textContent="—",ge.setAttribute("data-pc-lang","");return}const i=Zt(a);ge.hidden=!1,ge.textContent=i.toUpperCase(),ge.setAttribute("data-pc-lang",i),ge.setAttribute("aria-label",`Target language ${i.toUpperCase()} — long-press to tune Whisper`)},ve=(a,i)=>{var C;const h=!!t.getStackConfig().showRomanization,v=i.target.romanization||"",x=h&&v?`<p class="pc-romanization">${Q(v)}</p>`:"",D=(C=i.native)!=null&&C.text?`<p class="pc-native">${Q(i.native.text)}</p>`:"";a.innerHTML=se(`<h1 class="pc-target">${Q(i.target.text||"—")}</h1>`,x,D),je(i.targetLang)},lt=(a,i,l)=>{a.innerHTML=se(`<h1 class="pc-target">${Q(i)}</h1>`,"",`<p class="pc-native">${Q(l)}</p>`),je(null)},an=()=>{E&&ve(L,E)},Mt=async(a,i)=>{const l=ee.clientWidth||window.innerWidth,h=a==="left"?-1:1;L.style.transition="transform 220ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 200ms ease",L.style.transform=`translateX(${h*l}px)`,L.style.opacity="0",await new Promise(x=>window.setTimeout(x,220));const v=document.createElement("div");v.className="pc-card entering",v.id="pc-card",v.style.transition="none",v.style.transform=`translateX(${-h*l}px)`,v.style.opacity="0",i(v),ee.replaceChild(v,L),L=v,L.offsetWidth,L.style.transition="transform 280ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 240ms ease",L.style.transform="translateX(0)",L.style.opacity="1",L.classList.remove("entering"),L.classList.add("entered")},Et=async()=>{const a=t.getStackConfig();if(!a.languages||a.languages.length<2||!t.getRandomEntry)return null;const i=await t.getRandomEntry(),{target:l,native:h}=Xn(i,a.languages);return l?{entry:i,target:l,native:h,targetLang:l.language_code}:null},_t=()=>{fe||s||Et().then(a=>{!s&&a&&(fe=a)}).catch(a=>{console.error("[pronunciation-coach] prefetch failed:",a)})},on=async()=>{if(G==="scoring")return;Ge(),le();const a=t.getStackConfig();if(!a.languages||a.languages.length<2){E=null,lt(L,"Set up at least one target language","Open Corpán settings and add a target language to start practising."),W.disabled=!0,b.textContent="—";return}if(K>=0&&K<J.length-1){const l=J[K+1];K+=1,await Mt("left",h=>ve(h,l)),E=l,M("idle"),he();return}let i=fe;if(fe=null,!i)try{i=await Et()}catch(l){console.error("[pronunciation-coach] fetch next failed:",l),A(`Could not load a phrase: ${me(l)}`);return}if(!i){A("No phrases available — check your stack config.");return}J.push(i),K=J.length-1,await Mt("left",l=>ve(l,i)),E=i,M("idle"),he(),_t()},sn=async()=>{if(G==="scoring"||K<=0)return;Ge(),le();const a=J[K-1];K-=1,await Mt("right",i=>ve(i,a)),E=a,M("idle"),he()},qr=a=>{const i=R(a),l=N(a),h=U(a),v=I(a),x=()=>{i&&(i.innerHTML="",i.hidden=!0,i.className="pc-result-banner"),l&&(l.innerHTML="",l.hidden=!0,l.className="pc-result-transcript-up"),h&&(h.innerHTML="",h.hidden=!0,h.className="pc-result-bars-up"),v&&(v.innerHTML="",v.hidden=!0,v.className="pc-result-detail")};if(!(i&&!i.hidden||l&&!l.hidden||h&&!h.hidden||v&&!v.hidden)){x();return}i&&!i.hidden&&i.classList.add("leaving"),l&&!l.hidden&&l.classList.add("leaving"),h&&!h.hidden&&h.classList.add("leaving"),v&&!v.hidden&&v.classList.add("leaving"),window.setTimeout(x,220)},Rr=()=>qr(L),Ir=a=>{const i=Math.max(0,Math.min(1,a.overallScore)),l=Math.max(0,Math.min(1,a.noSpeechProb??0)),h=a.compressionRatio??0,v=Math.max(0,Math.min(1,a.freeVsConstrainedSimilarity??1)),x=O=>`${Math.round(O*100)}%`,D=l>.5;let C="bad",B="Try again";D?(C="bad",B="🎙️ Couldn't hear you"):i>=.95?(C="good",B="✨ Perfect!"):i>=.85?(C="good",B="🎉 Nailed it!"):i>=.75?(C="good",B="Great"):i>=.6?(C="okay",B="Pretty good"):i>=.45?(C="okay",B="Close — keep going"):i>=.25&&(C="bad",B="Keep practicing"),D||(i>=.85?(V+=1,Qn(document.body)):i>=.6||(V=0)),z(),he();const $e=Xt(a.words||[]),T=((E==null?void 0:E.target.text)||"").trim(),ye=rt(T),be=(a.freeText||"").trim(),mt=rt(be),ft=ye.length>0&&ye.length===$e.length,Qe=ye.length>0&&ye.length===mt.length,u=T.length>0&&be.length===0,_=(E==null?void 0:E.targetLang)||a.language||"",Y=be.length&&T.length?at(xe(be,_),xe(T,_)):u?0:null,q=ye.length?ye.map((O,X)=>({word:O,heardProb:ft?$e[X].probability:null,freeSim:Qe?at(xe(O,_),xe(mt[X],_)):Y})):T?[{word:T,heardProb:null,freeSim:Y}]:[],oe=O=>O===null?null:O>=.9?"good":O>=.6?"okay":"bad",ae=O=>O===null?null:O>=.85?"good":O>=.6?"okay":"bad",we={bad:0,okay:1,good:2},Ce=O=>{const X=oe(O.heardProb),ie=ae(O.freeSim);return X===null&&ie===null?"":X===null?ie:ie===null||we[X]<=we[ie]?X:ie},qe=q.map((O,X)=>`<button class="pc-word ${Ce(O)}" type="button" data-pc-word-idx="${X}" aria-label="Speak ${Q(O.word)}">${Q(O.word)}</button>`).join(""),ht=be.length?`<div class="pc-transcript-row heard" role="button" tabindex="0"
             data-pc-speak="heard" data-no-swipe
             aria-label="Play what Whisper heard">
           <span class="pc-transcript-label">Heard you say</span>
           <span class="pc-transcript-line">
             <span class="pc-transcript-play" aria-hidden="true">▶</span>
             <span class="pc-transcript-text">${Q(be)}</span>
           </span>
         </div>`:u?`<div class="pc-transcript-row heard empty">
             <span class="pc-transcript-label">Heard you say</span>
             <span class="pc-transcript-line">
               <span class="pc-transcript-text empty">(couldn't make out the words)</span>
             </span>
           </div>`:"",gt=ht?`<div class="pc-transcripts">${ht}</div>`:"",Nt={"pa-arab":"Different writing system — scoring may be off","yue-hant-hk":"Different writing system — scoring may be off","zh-hans":"Different writing system — scoring may be off","zh-hant":"Different writing system — scoring may be off"},Re=(a.language??"").toLowerCase(),fn=Nt[Re],Ie=[];l>.2&&Ie.push('<div class="pc-chip pc-chip-warn">Sounded faint — try a bit louder</div>');const Dr=_.toLowerCase().split("-")[0],Fr=jn.has(Dr)?3.5:2.4;h>Fr&&Ie.push('<div class="pc-chip pc-chip-warn">Sounded a bit garbled</div>'),u?Ie.push(`<div class="pc-chip pc-chip-warn">Couldn't make out the words</div>`):v<.6&&Ie.push(`<div class="pc-chip pc-chip-warn">Words didn't quite match</div>`),fn&&Ie.push(`<div class="pc-chip">${Q(fn)}</div>`);const Wr=Ie.length?`<div class="pc-chips pc-diagnostics">${Ie.join("")}</div>`:"",Pe=R(L),zt=N(L),Ht=U(L),Be=I(L);if(!Pe||!Be){console.error("[pronunciation-coach] renderResult: card missing result slots");return}D?(Pe.className=`pc-result-banner ${C}`,Pe.innerHTML=`
        <span class="pc-result-banner-score">—</span>
        <span class="pc-result-banner-sep">·</span>
        <span class="pc-result-banner-text">${B}</span>
      `,Pe.hidden=!1,Be.innerHTML=`
        <div class="pc-chips">
          <div class="pc-chip">Move the device closer or speak louder.</div>
        </div>
      `,Be.hidden=!1):(Pe.className=`pc-result-banner ${C}`,Pe.innerHTML=`
        <span class="pc-result-banner-score">${x(i)}</span>
        <span class="pc-result-banner-sep">·</span>
        <span class="pc-result-banner-text">${B}</span>
      `,Pe.hidden=!1,zt&&(zt.innerHTML=gt,zt.hidden=!gt),Ht&&(Ht.innerHTML="",Ht.hidden=!0),Be.innerHTML=`
        ${qe?`<div class="pc-words">${qe}</div>`:""}
        ${Wr}
      `,Be.hidden=!1);const hn=(O,X)=>{const ie=(E==null?void 0:E.targetLang)||a.language||"en";try{const pe=t.speak(ie,O);pe&&typeof pe.catch=="function"&&pe.catch(Ur=>{console.error(`[pronunciation-coach] ${X} speak failed:`,Ur)})}catch(pe){console.error(`[pronunciation-coach] ${X} speak threw:`,pe)}};Be.querySelectorAll("button.pc-word[data-pc-word-idx]").forEach(O=>{O.addEventListener("click",()=>{const X=O.getAttribute("data-pc-word-idx");if(X===null)return;const ie=Number(X),pe=q[ie];pe&&hn(pe.word.trim(),"word")})}),L.querySelectorAll(".pc-transcript-row[data-pc-speak]").forEach(O=>{const X=()=>{be&&hn(be,"heard")};O.addEventListener("click",X),O.addEventListener("keydown",ie=>{const pe=ie.key;(pe==="Enter"||pe===" ")&&(ie.preventDefault(),X())})})},Ge=()=>{d();const a=o;o=null,a&&n.cancelSession({sessionId:a}).catch(i=>{console.error("[pronunciation-coach] cancelSession failed:",i)})},cn=async()=>{if(!E||!F)return;le(),Rr();const a=Kn();o=a;try{M("recording");const i=Zt(E.targetLang),l=await n.startSession({sessionId:a,language:i,expectedText:E.target.text,whisperParams:Wt(i)});if(s)return;if(!l.started)throw new Error("STT plugin reported started=false");const h=n.subscribeAudioLevel;if(h){d();const v=a;c=Gt(x=>h(x),Ut(i),()=>{s||o===v&&(console.log("[pronunciation-coach] silence → stopRecording"),qt())})}}catch(i){console.error("[pronunciation-coach] startSession failed:",i),o=null,A(`Could not start recording: ${me(i)}`),M("idle")}},Ct=async a=>{if(!n)throw new Error("STT unavailable");const i=ke(a),l=await Kt(n.prepare({model:i}),Bn(a),`Loading ${re(a)} model`);if(!l.ready){const h=new Error(l.message||"Model not ready");throw h.code=l.code,h}return l},qt=async()=>{d();const a=o;if(!a){M("idle");return}o=null;try{M("scoring");const i=await Kt(n.stopSession({sessionId:a}),Dn,"Scoring");if(s)return;Ir(i),M("idle")}catch(i){const l=me(i),h=St(i);if(console.error(`[pronunciation-coach] stopSession failed (code=${h??"—"}):`,l),M("idle"),h==="LOAD_FAILED"){F=!1,W.disabled=!0,b.textContent="Model needs reinstall",A(`${re(P)} model failed to load — opening setup so you can reinstall.`),Rt().catch(v=>{console.error("[pronunciation-coach] openModelSetup after LOAD_FAILED:",v)});return}if(h==="NETWORK"){A("Network hiccup while scoring. Try again — your model is fine.");return}A(`Scoring failed: ${l}`)}};W.addEventListener("click",()=>{G==="idle"?cn().catch(a=>{console.error("[pronunciation-coach] startRecording threw:",a)}):G==="recording"&&qt().catch(a=>{console.error("[pronunciation-coach] stopRecording threw:",a)})}),f.addEventListener("click",()=>{Ge(),r!=null&&r.onClose?r.onClose():ot()});const ln=async a=>{if(!(n!=null&&n.prepare))return!1;try{const i=await n.prepare({model:ke(a)});return i.ready?!0:(console.error(`[pronunciation-coach] ensureLoaded(${a}) failed: code=${i.code??"—"} msg=${i.message??""}`),!1)}catch(i){return console.error(`[pronunciation-coach] ensureLoaded(${a}) threw:`,i),!1}},Rt=async()=>{if(de)return;de=!0,Ge(),M("idle");const a=P,i=F?P:null;console.log(`[pronunciation-coach] openModelSetup: modelMode=${P} modelReady=${F} activeForOverlay=${i??"null"}`);let l;try{l=await Br({currentActive:i,headline:"Parlometron · Models",sub:"These are large, experimental, cutting-edge AI speech models running entirely on your device — no servers, no internet, no privacy compromises. They are also, frankly, not as reliable as you might hope. The bigger ones might crash your phone. The smaller ones might transcribe 'good morning' as 'goldfish moon'. Any of them might surprise you in either direction. Welcome to on-device AI in 2026. Don't take the scoring too seriously. 🤷"})}finally{de=!1,_e()}if(s)return;if(l.kind==="exit"){!F&&a&&await ln(a)&&(F=!0);return}if(l.kind==="cancelled"){M("idle"),!F&&a&&await ln(a)&&(F=!0);return}if(l.mode===a&&F){M("idle");return}const h=l.mode;F=!1,W.disabled=!0;const v=re(h);if(n!=null&&n.unload&&a&&a!==h){b.textContent=`Unloading ${re(a)}…`,ne(`Unloading ${re(a)} model to free memory…`);try{await n.unload()}catch(x){console.warn("[pronunciation-coach] explicit unload before switch failed:",x)}}b.textContent=`Loading ${v} model…`,ne(`Loading ${v} model…
This can take 10–30s on first launch.`);try{const x=await Ct(h);F=!0,P=h,he(),_e(),console.log(`[pronunciation-coach] WhisperKit prepared: ${x.model} (${v})`),te(),W.disabled=!1,M("idle")}catch(x){const D=me(x),C=St(x);if(console.error(`[pronunciation-coach] post-setup load failed (code=${C??"—"}):`,D),a&&a!==h)try{const B=await Ct(a);F=!0,P=a,_e(),te(),W.disabled=!1,M("idle"),A(C==="MODEL_NOT_INSTALLED"?`${v} isn't installed yet. Staying on ${re(a)}.`:C==="NETWORK"?`${v} needs the tokenizer — check your connection. Staying on ${re(a)}.`:`Couldn't switch to ${v}: ${D}. Staying on ${re(a)}.`),console.log(`[pronunciation-coach] reverted to ${B.model} (${re(a)}) after switch failure`);return}catch(B){console.error("[pronunciation-coach] revert to previous model also failed:",B)}te(),A(C==="MODEL_NOT_INSTALLED"?`${v} model isn't fully installed (likely a partial download). Tap the model badge to reinstall.`:C==="NETWORK"?`${v} model needs the tokenizer — check your connection and try again.`:`Could not load ${v} model: ${D}`),b.textContent="Model unavailable"}};k.addEventListener("click",()=>{Rt().catch(a=>{console.error("[pronunciation-coach] openModelSetup threw:",a)})});let dt=!1,It=0,dn=0,pn=0,pt=0,Pt=0,Ye=!1,At=!1,Ke=null,ut=!1;const Pr=()=>{if(E)try{const a=t.speak(E.targetLang,E.target.text);a&&typeof a.catch=="function"&&a.catch(i=>{console.error("[pronunciation-coach] speak phrase failed:",i)})}catch(a){console.error("[pronunciation-coach] speak phrase threw:",a)}},Ar=a=>!a||!(a instanceof Element)?!1:!!a.closest("button, input, textarea, select, a, [data-no-swipe]"),ze=Z;ze.addEventListener("pointerdown",a=>{G!=="scoring"&&(Ar(a.target)||a.pointerType==="mouse"&&a.button!==0||(dt=!0,It=a.clientX,dn=a.clientY,pt=a.clientX,Pt=a.clientY,pn=performance.now(),Ye=!1,At=!1,Ke=null,L.classList.add("dragging")))},{passive:!0}),ze.addEventListener("pointermove",a=>{if(!dt)return;pt=a.clientX,Pt=a.clientY;const i=pt-It,l=Pt-dn;if(!Ye&&!At)if(Math.abs(i)>12&&Math.abs(i)>Math.abs(l)*1.2){Ye=!0;try{ze.setPointerCapture(a.pointerId),Ke=a.pointerId}catch{}}else Math.abs(l)>12&&(At=!0);if(Ye){const h=i*.9;L.style.transition="none",L.style.transform=`translateX(${h}px) rotate(${h*.01}deg)`,L.style.opacity=String(Math.max(.4,1-Math.abs(i)/400))}},{passive:!0});const un=()=>{if(!dt)return;if(dt=!1,L.classList.remove("dragging"),Ke!==null){try{ze.releasePointerCapture(Ke)}catch{}Ke=null}if(!Ye){L.style.transition="transform 200ms ease, opacity 200ms ease",L.style.transform="",L.style.opacity="";return}const a=pt-It,i=Math.max(1,performance.now()-pn),l=Math.abs(a)/i,h=Math.abs(a)>=Nn,v=l>=zn;h||v?(ut=!0,window.setTimeout(()=>{ut=!1},500),a<0?on().catch(x=>console.error("[pronunciation-coach] swipe-next failed:",x)):K>0?sn().catch(x=>console.error("[pronunciation-coach] swipe-prev failed:",x)):(L.style.transition="transform 220ms ease, opacity 220ms ease",L.style.transform="",L.style.opacity="")):(L.style.transition="transform 220ms ease, opacity 220ms ease",L.style.transform="",L.style.opacity="")};ze.addEventListener("pointerup",un,{passive:!0}),ze.addEventListener("pointercancel",un,{passive:!0}),ee.addEventListener("click",a=>{if(ut){ut=!1;return}const i=a.target;i&&(i.closest("button, input, a")||i.closest(".pc-target, .pc-romanization")&&Pr())});const mn=a=>{a.key==="ArrowLeft"?sn().catch(i=>console.error("[pronunciation-coach] arrow-left failed:",i)):a.key==="ArrowRight"?on().catch(i=>console.error("[pronunciation-coach] arrow-right failed:",i)):a.key==="Escape"?ot():(a.key===" "||a.code==="Space")&&(a.preventDefault(),G==="idle"&&F&&E?cn().catch(i=>console.error("[pronunciation-coach] space-start failed:",i)):G==="recording"&&qt().catch(i=>console.error("[pronunciation-coach] space-stop failed:",i)))};window.addEventListener("keydown",mn);const Or=700,Nr=8;let Ve=null,He=null,Xe=null;const Ot=()=>{Ve!==null&&(window.clearTimeout(Ve),Ve=null),He=null,Xe=null};e.addEventListener("pointerdown",a=>{var h,v;const i=(v=(h=a.target)==null?void 0:h.closest)==null?void 0:v.call(h,"[data-pc-lang-badge]");if(!i)return;const l=i.getAttribute("data-pc-lang")||"";l&&(He={x:a.clientX,y:a.clientY},Xe=l,Ve=window.setTimeout(()=>{Ve=null,Xe&&!s&&xn(Xe),Xe=null,He=null},Or))}),e.addEventListener("pointermove",a=>{if(!He)return;const i=a.clientX-He.x,l=a.clientY-He.y;Math.hypot(i,l)>Nr&&Ot()}),e.addEventListener("pointerup",Ot),e.addEventListener("pointercancel",Ot);const zr=()=>{const a=Jt(Ne);if(!a||!a.phrases||a.phrases.length===0)return!1;V=Math.max(0,Math.floor(a.streak)),J.length=0;for(const l of a.phrases)J.push(Wn(l));const i=Math.max(0,Math.min(J.length-1,a.idx));return K=i,E=J[i],E&&an(),z(),!0},Hr=async()=>{const a=t.getStackConfig();if(!a.languages||a.languages.length<2){E=null,lt(L,"Set up at least one target language","Open Corpán settings and add a target language to start practising."),W.disabled=!0,b.textContent="—";return}if(zr()){console.log(`[pronunciation-coach] restored ${J.length} phrase(s) from storage; idx=${K}, streak=${V}`),_t();return}try{const i=await Et();if(s)return;if(!i){A("No phrases available — check your stack config.");return}J.push(i),K=0,E=i,an(),he(),_t()}catch(i){console.error("[pronunciation-coach] loadFirstPhrase failed:",i),E=null,A(`Could not load a phrase: ${me(i)}`),W.disabled=!0,b.textContent="—"}},Br=a=>new Promise(i=>{let{currentActive:l}=a;const h=document.createElement("div");h.className="pc-setup-root",h.innerHTML=`
        <div class="pc-backdrop"></div>
        <div class="pc-setup">
          <div class="pc-setup-header">
            <div class="pc-subtitle">Speech Models</div>
            <button class="pc-close" id="pc-setup-close" type="button" aria-label="Close">×</button>
          </div>
          <div class="pc-setup-body">
            <h1 class="pc-setup-headline">${Q(a.headline)}</h1>
            <p class="pc-setup-sub">${Q(a.sub)}</p>

            ${yt().map(u=>{const _=u.approxSizeMB>=1e3?`~${(u.approxSizeMB/1e3).toFixed(1)} GB`:`~${u.approxSizeMB} MB`;return`
            <div class="pc-setup-card" data-mode="${u.id}">
              <div class="pc-setup-card-head">
                <div>
                  <div class="pc-setup-card-name">${Q(u.label)} <span class="pc-setup-card-status" data-status="${u.id}"></span></div>
                  <div class="pc-setup-card-meta">${_}</div>
                </div>
                <div class="pc-setup-card-actions" data-actions="${u.id}"></div>
              </div>
              <div class="pc-setup-card-desc">${Q(u.shortDesc)}</div>
              <div class="pc-setup-card-procon">
                <ul class="pc-setup-card-pros">
                  ${u.pros.map(Y=>`<li>${Q(Y)}</li>`).join("")}
                </ul>
                <ul class="pc-setup-card-cons">
                  ${u.cons.map(Y=>`<li>${Q(Y)}</li>`).join("")}
                </ul>
              </div>
              <div class="pc-setup-card-techid" title="Underlying model file (whisper.cpp ggml format)">${Q(u.folder)}</div>
              <div class="pc-setup-progress" data-progress="${u.id}" hidden>
                <div class="pc-setup-progress-bar"><div class="pc-setup-progress-fill"></div></div>
                <div class="pc-setup-progress-label">Preparing…</div>
              </div>
            </div>`}).join("")}

            <div class="pc-setup-error" id="pc-setup-error" hidden></div>
            <div class="pc-setup-note">
              Models live on your device under the app's data folder. They never leave your device. You can switch or remove them anytime from this screen.
            </div>
          </div>
        </div>
      `,e.appendChild(h);const v=h.querySelector("#pc-setup-error"),x=Object.fromEntries(yt().map(u=>[u.id,u.id===l?!0:null]));let D=null;const C=(u,_)=>{const Y=h.querySelector(`[data-progress="${u}"]`);Y&&(Y.hidden=!_)},B=(u,_,Y)=>{const q=h.querySelector(`[data-progress="${u}"]`);if(!q)return;const oe=q.querySelector(".pc-setup-progress-fill");oe&&(oe.style.width=`${Math.round(Math.max(0,Math.min(1,_))*100)}%`);const ae=q.querySelector(".pc-setup-progress-label");ae&&(ae.textContent=Y)},$e=()=>{h.parentNode&&h.parentNode.removeChild(h)},T=()=>{for(const u of Te){const _=u.id,Y=h.querySelector(`[data-status="${_}"]`),q=h.querySelector(`[data-actions="${_}"]`);if(!Y||!q)continue;const oe=l===_,ae=D===_,we=oe?!0:x[_],Ce=we===null&&!oe&&!ae;if(Y.textContent=ae?"Installing…":oe?"Active":Ce?"Checking…":we?"Installed":"Not installed",Y.dataset.state=ae?"installing":oe?"active":Ce?"checking":we?"installed":"absent",q.innerHTML="",ae||Ce)continue;const qe=(ht,gt,Nt)=>{const Re=document.createElement("button");Re.type="button",Re.className=`pc-setup-btn pc-setup-btn-${gt}`,Re.textContent=ht,Re.addEventListener("click",Nt),q.appendChild(Re)};we?oe||(qe("Use this","primary",()=>{console.log(`[pronunciation-coach] CLICK Use-this mode=${_}`),be(_)}),qe("Reinstall","ghost",()=>{console.log(`[pronunciation-coach] CLICK Reinstall mode=${_}`),ft(_,!0)}),qe("Remove","danger",()=>{console.log(`[pronunciation-coach] CLICK Remove mode=${_}`),mt(_)})):qe("Install","primary",()=>{console.log(`[pronunciation-coach] CLICK Install mode=${_}`),ft(_)})}},ye=async()=>{if(n!=null&&n.validateModel){for(const u of Te){if(l===u.id){x[u.id]=!0;continue}try{const _=await n.validateModel({model:u.folder});x[u.id]=_.valid}catch(_){console.error(`[pronunciation-coach] validate ${u.id} failed:`,_),x[u.id]=!1}}T()}},be=u=>{$e(),i({kind:"selected",mode:u})},mt=async u=>{if(D||!(n!=null&&n.wipeModel))return;console.log(`[pronunciation-coach] removeModel: mode=${u} folder=${ke(u)} currentActive=${l??"null"} installed[${u}]=${x[u]}`);const _=x[u];D=u,T(),v.hidden=!0;try{await n.wipeModel({model:ke(u)}),x[u]=!1,l===u&&(l=null)}catch(Y){x[u]=_;const q=me(Y);v.textContent=`Remove failed: ${q}`,v.hidden=!1}finally{D=null,T()}},ft=async(u,_=!1)=>{var Y;if(!(D||s||!(n!=null&&n.installModel))){if(D=u,v.hidden=!0,v.textContent="",T(),C(u,!0),_&&(n!=null&&n.wipeModel)){B(u,0,"Wiping previous install…");try{await n.wipeModel({model:ke(u)})}catch(q){console.warn("[pronunciation-coach] pre-reinstall wipe failed (continuing):",q)}}B(u,0,"Starting…");try{if(await n.installModel({model:ke(u),downloadUrl:(Y=Se(u))==null?void 0:Y.downloadUrl},q=>{if(q.model===ke(u))if(q.phase==="downloading"){let ae=`Downloading ${Math.round((q.fraction??0)*100)}%`;if(q.completed!=null&&q.total&&q.total>0){const we=Ce=>(Ce/1048576).toFixed(0);ae+=` · ${we(q.completed)} / ${we(q.total)} MB`}B(u,q.fraction??0,ae)}else q.phase==="verifying"?B(u,1,"Verifying files…"):q.phase==="verified"?B(u,1,"Verified ✓"):q.phase==="failed"&&B(u,0,`Failed: ${q.error??"unknown"}`)}),s)return;x[u]=!0,D=null,B(u,1,"Verified ✓"),setTimeout(()=>{$e(),i({kind:"selected",mode:u})},300)}catch(q){D=null,C(u,!1);const oe=me(q);if(console.error(`[pronunciation-coach] install ${u} failed:`,oe),v.textContent=`Install failed: ${oe}`,v.hidden=!1,l&&l!==u&&(n!=null&&n.prepare))try{(await n.prepare({model:ke(l)})).ready&&console.log(`[pronunciation-coach] restored ${l} kit after ${u} install failed`)}catch(ae){console.error(`[pronunciation-coach] kit restore after ${u} install failure threw:`,ae)}T()}}},Qe=h.querySelector("#pc-setup-close");if(Qe==null||Qe.addEventListener("click",()=>{D||($e(),l&&x[l]?i({kind:"cancelled"}):(ot(),i({kind:"exit"})))}),l){const u=h.querySelector(`[data-mode="${l}"]`);u==null||u.classList.add("pc-setup-card-suggested")}T(),ye().catch(u=>{console.error("[pronunciation-coach] refreshInstallState threw:",u)})});return(async()=>{var $e;ne("Checking models…");let a;try{a=await n.isAvailable()}catch(T){if(console.error("[pronunciation-coach] stt.isAvailable bridge call threw:",T),s)return;te(),$("Speech recognition bridge failed",`The native speech-recognition plugin returned an error: ${String(T)}`);return}if(s)return;if(!a){te(),$();return}try{const T=await n.getStatus();vn(T.availableMemoryMB??null),console.log(`[pronunciation-coach] device memory budget: available=${T.availableMemoryMB??"?"}MB physical=${T.physicalMemoryMB??"?"}MB raw=${JSON.stringify(T)}`)}catch(T){console.warn("[pronunciation-coach] getStatus failed; using conservative budget (Large variants hidden):",T)}const i=Jt(Ne);i!=null&&i.mode&&Se(i.mode)&&(P=i.mode);const l=Se(P);if(l&&wn(l)){const T=bn().id;console.warn(`[pronunciation-coach] saved model "${P}" exceeds this device's memory budget; demoting to "${T}"`),P=T}_e();const h=re(P),v=((($e=Se(P))==null?void 0:$e.approxSizeMB)??0)>=300;ne(v?`Loading ${h} model… first load can take ~1 minute for large models. Subsequent launches are faster.`:`Loading ${h} model…`),b.textContent=v?`Loading ${h} model… (first time can take ~1 minute)`:`Loading ${h} model…`;const x=P;let D=null,C;try{await Promise.all([Ct(x).then(T=>{F=!0,console.log(`[pronunciation-coach] WhisperKit prepared: ${T.model} (${re(x)})`)}),Hr()])}catch(T){D=T,C=St(T),console.error(`[pronunciation-coach] boot prepare failed (code=${C??"—"}):`,me(T));const ye=me(T);!C&&/<model dir missing>|Run install first/i.test(ye)&&console.warn("%c[pronunciation-coach] STALE PLUGIN DETECTED","background:#9333ea;color:#fff;padding:2px 6px;border-radius:4px;font-weight:600","\nThe iOS app is running an old tauri-plugin-stt binary (no `code` field on errors, no marker file).",`
ValidateModel false-negatives in that build trigger destructive wipes on every Install click.`,`
Fix: rebuild and resideload the iOS app (cargo tauri ios dev) to pick up the marker-file fix.`)}if(s)return;if(F&&!D){te(),M("idle");return}te();const B=re(x);if(C==="NETWORK"){A(`${B} model needs the tokenizer — check your connection. Your model files are intact.`),W.disabled=!0,b.textContent="Network needed";return}if(C&&C!=="MODEL_NOT_INSTALLED"&&C!=="LOAD_FAILED"){A(`Model failed to load: ${me(D)}`),W.disabled=!0,b.textContent="Model unavailable";return}C==="LOAD_FAILED"&&A(`${B} model failed to load. Use Reinstall in setup if it keeps happening.`),W.disabled=!0,b.textContent=`Loading ${B} model…`,Rt().catch(T=>{console.error("[pronunciation-coach] openModelSetup after boot prepare failure threw:",T)})})().catch(a=>{console.error("[pronunciation-coach] boot threw:",a)}),{unmount:()=>{s=!0,Ge(),window.removeEventListener("keydown",mn),te(),S(),e.innerHTML=""}}},Lt=3,en="pc:parlometron:game-state",Zn=()=>{try{return crypto.randomUUID()}catch{return`p_${Math.random().toString(36).slice(2,10)}_${Date.now()}`}},kt=e=>({id:Zn(),name:e}),er=(e,t)=>{if(e.length<2)throw new Error("Parlometron needs at least 2 players");return{players:e.map(r=>({...r})),winTarget:t,currentRound:0,currentRoundOrder:[],currentPlayerIdx:0,attemptsLeft:{},bestThisRound:{},expectedTextThisRound:"",roundsWon:Object.fromEntries(e.map(r=>[r.id,0])),history:[]}},tr=e=>{const t=e.slice();for(let r=t.length-1;r>0;r--){const n=Math.floor(Math.random()*(r+1));[t[r],t[n]]=[t[n],t[r]]}return t},nr=(e,t)=>(e.currentRound+=1,e.currentRoundOrder=tr(e.players.map(r=>r.id)),e.currentPlayerIdx=0,e.attemptsLeft=Object.fromEntries(e.players.map(r=>[r.id,Lt])),e.bestThisRound=Object.fromEntries(e.players.map(r=>[r.id,null])),e.expectedTextThisRound=t,e),rr=(e,t,r)=>{const n=e.currentRoundOrder[e.currentPlayerIdx];if(!n)return e;const s=e.bestThisRound[n],o=Math.max(0,Math.min(100,Math.round(t)));return(!s||o>s.bestPercent)&&(e.bestThisRound[n]={playerId:n,bestPercent:o,heardText:r}),e.attemptsLeft[n]=Math.max(0,(e.attemptsLeft[n]??0)-1),e},ar=e=>{const t=e.currentRoundOrder[e.currentPlayerIdx];return t&&(e.attemptsLeft[t]=0),e.currentPlayerIdx+=1,e},or=e=>e.currentPlayerIdx>=e.currentRoundOrder.length,sr=e=>e.players.some(t=>(e.roundsWon[t.id]??0)>=e.winTarget),ir=e=>{let t=-1;for(const r of e.players){const n=e.roundsWon[r.id]??0;n>t&&(t=n)}return t<1?[]:e.players.filter(r=>(e.roundsWon[r.id]??0)===t)},cr=e=>{var o;const t=e.players.map(c=>e.bestThisRound[c.id]??{playerId:c.id,bestPercent:0,heardText:""}).sort((c,d)=>d.bestPercent-c.bestPercent),r=((o=t[0])==null?void 0:o.bestPercent)??0,n=r>0?t.filter(c=>c.bestPercent===r).map(c=>c.playerId):[];for(const c of n)e.roundsWon[c]=(e.roundsWon[c]??0)+1;const s={round:e.currentRound,expectedText:e.expectedTextThisRound,results:t,winnerIds:n};return e.history.push(s),{state:e,round:s}},xt=e=>{const t=e.currentRoundOrder[e.currentPlayerIdx];return t?e.players.find(r=>r.id===t)??null:null},st=e=>{try{localStorage.setItem(en,JSON.stringify(e))}catch(t){console.error("[parlometron/state] save failed:",t)}},We=()=>{try{localStorage.removeItem(en)}catch(e){console.error("[parlometron/state] clear failed:",e)}},it=2,Ue=8,lr=e=>e.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;"),dr=e=>e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),pr=e=>{var S,$;const t=((S=e.initial)==null?void 0:S.players.map(f=>({...f})))??[kt("Player 1"),kt("Player 2")];let r=(($=e.initial)==null?void 0:$.winTarget)??5;const n=()=>{const f=[3,5,7].map(y=>`
        <button type="button"
                class="pc-pm-target ${r===y?"active":""}"
                data-pm-target="${y}">
          ${y}
        </button>`).join("");e.container.innerHTML=`
      <div class="pc-pm-root pc-pm-lobby">
        <header class="pc-pm-head">
          <div class="pc-pm-head-eyebrow-row">
            <span class="pc-pm-eyebrow">Parlometron</span>
          </div>
          <div class="pc-pm-head-action-row">
            <button class="pc-pm-back" data-pm-back aria-label="Back to mode picker">‹</button>
            <span class="pc-pm-headline">New game</span>
            <div class="pc-pm-head-spacer"></div>
          </div>
        </header>

        <section class="pc-pm-section">
          <h3 class="pc-pm-section-title">Players (${t.length} / ${Ue})</h3>
          <ul class="pc-pm-roster" id="pc-pm-roster">${s()}</ul>
          <button class="pc-pm-add" data-pm-add
                  ${t.length>=Ue?"disabled":""}>
            + Add Player
          </button>
        </section>

        <section class="pc-pm-section">
          <h3 class="pc-pm-section-title">First to win</h3>
          <div class="pc-pm-target-row">
            ${f}
            <span class="pc-pm-target-suffix">rounds</span>
          </div>
        </section>

        <footer class="pc-pm-foot">
          <button class="pc-pm-start" id="pc-pm-start" disabled>
            Start game
          </button>
        </footer>
      </div>
    `,g(),o()},s=()=>t.map((f,y)=>`
        <li class="pc-pm-roster-row" data-pm-row="${f.id}">
          <span class="pc-pm-roster-num">${y+1}</span>
          <input type="text"
                 class="pc-pm-roster-name"
                 data-pm-name="${f.id}"
                 value="${lr(f.name)}"
                 maxlength="24"
                 placeholder="Player name"
                 autocapitalize="words"
                 autocorrect="off"
                 spellcheck="false" />
          <button class="pc-pm-roster-remove"
                  data-pm-remove="${f.id}"
                  aria-label="Remove ${dr(f.name)}"
                  ${t.length<=it?"disabled":""}>×</button>
        </li>`).join(""),o=()=>{const f=e.container.querySelector("#pc-pm-start");if(!f)return;const y=t.every(p=>p.name.trim().length>0);f.disabled=!y||t.length<it},c=()=>{const f=e.container.querySelector("[data-pm-add]");f&&(f.disabled=t.length>=Ue)},d=()=>{const f=e.container.querySelector("#pc-pm-roster");f&&(f.innerHTML=s());const y=e.container.querySelector(".pc-pm-section-title");y&&(y.textContent=`Players (${t.length} / ${Ue})`),m(),c(),o()},m=()=>{e.container.querySelectorAll("[data-pm-name]").forEach(f=>{const y=f.getAttribute("data-pm-name")||"";f.addEventListener("input",()=>{const p=t.find(k=>k.id===y);p&&(p.name=f.value),o()})}),e.container.querySelectorAll("[data-pm-remove]").forEach(f=>{f.addEventListener("click",()=>{if(t.length<=it)return;const y=f.getAttribute("data-pm-remove")||"",p=t.findIndex(k=>k.id===y);p>=0&&(t.splice(p,1),d())})})},g=()=>{var f,y,p;(f=e.container.querySelector("[data-pm-back]"))==null||f.addEventListener("click",()=>e.onBack()),(y=e.container.querySelector("[data-pm-add]"))==null||y.addEventListener("click",()=>{t.length>=Ue||(t.push(kt(`Player ${t.length+1}`)),d())}),e.container.querySelectorAll("[data-pm-target]").forEach(k=>{k.addEventListener("click",()=>{const Z=Number(k.getAttribute("data-pm-target"));(Z===3||Z===5||Z===7)&&(r=Z,e.container.querySelectorAll("[data-pm-target]").forEach(ee=>{ee.classList.toggle("active",Number(ee.getAttribute("data-pm-target"))===Z)}))})}),(p=e.container.querySelector("#pc-pm-start"))==null||p.addEventListener("click",()=>{const k=t.map(ee=>({...ee,name:ee.name.trim()})).filter(ee=>ee.name.length>0);if(k.length<it)return;const Z=er(k,r);e.onStart(Z)}),m()};return n(),{unmount:()=>{e.container.innerHTML=""}}},Tt=e=>e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),tn=e=>new Promise(t=>{var o,c,d;const r=document.createElement("div");r.className="pc-pm-confirm-root",r.innerHTML=`
      <div class="pc-pm-confirm-backdrop" data-pm-confirm-backdrop></div>
      <div class="pc-pm-confirm-sheet" role="alertdialog" aria-modal="true">
        <p class="pc-pm-confirm-msg">${Tt(e.message)}</p>
        <div class="pc-pm-confirm-foot">
          <button class="pc-pm-confirm-cancel" data-pm-confirm-cancel>
            ${Tt(e.cancelLabel??"Cancel")}
          </button>
          <button class="pc-pm-confirm-go ${e.destructive?"danger":""}"
                  data-pm-confirm-go>
            ${Tt(e.confirmLabel??"Confirm")}
          </button>
        </div>
      </div>`,document.body.appendChild(r),requestAnimationFrame(()=>r.classList.add("open"));const n=m=>{r.classList.remove("open"),window.setTimeout(()=>{r.parentNode&&r.parentNode.removeChild(r)},200),window.removeEventListener("keydown",s),t(m)},s=m=>{m.key==="Escape"?n(!1):m.key==="Enter"&&n(!0)};window.addEventListener("keydown",s),(o=r.querySelector("[data-pm-confirm-backdrop]"))==null||o.addEventListener("click",()=>n(!1)),(c=r.querySelector("[data-pm-confirm-cancel]"))==null||c.addEventListener("click",()=>n(!1)),(d=r.querySelector("[data-pm-confirm-go]"))==null||d.addEventListener("click",()=>n(!0))}),ur=9e4,mr=()=>`pm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`,ct=e=>e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),fr=e=>e?e.split("-")[0].toLowerCase():"en",hr=async(e,t,r)=>{let n=null;const s=new Promise((o,c)=>{n=setTimeout(()=>{c(new Error(`${r} timed out after ${Math.round(t/1e3)}s`))},t)});try{return await Promise.race([e,s])}finally{n&&clearTimeout(n)}},gr=(e,t)=>{const r=t.length>0?e.translations.find(o=>o.language_code===t[0])??null:null,n=[];for(const o of t.slice(1)){const c=e.translations.find(d=>d.language_code===o);c&&n.push(c)}return{target:n.length>0?n[Math.floor(Math.random()*n.length)]:null,native:r}},vr=e=>{var W;const t=e.hostApi.stt;if(!t)return e.container.innerHTML=`
      <div class="pc-pm-root pc-pm-error">
        <p>Whisper STT is not available on this device.</p>
        <button class="pc-pm-start" data-pm-quit>Back</button>
      </div>`,(W=e.container.querySelector("[data-pm-quit]"))==null||W.addEventListener("click",e.onQuit),{unmount:()=>e.container.innerHTML=""};let r=!1,n="loading",s=null,o=null,c=null,d=null,m=null;const g=()=>{m&&(m.stop(),m=null)},S=()=>{var b,R,N,U;e.container.innerHTML=`
      <div class="pc-pm-root pc-pm-round">
        <header class="pc-pm-head">
          <div class="pc-pm-head-eyebrow-row">
            <span class="pc-pm-eyebrow" data-pm-eyebrow></span>
          </div>
          <div class="pc-pm-head-action-row">
            <button class="pc-pm-back" data-pm-quit aria-label="Quit game">‹</button>
            <span class="pc-pm-headline" data-pm-headline></span>
            <div class="pc-pm-head-spacer pc-pm-turn-indicator" data-pm-turn></div>
          </div>
        </header>

        <div class="pc-pm-deck">
          <div class="pc-card pc-pm-card">
            <div class="pc-card-above">
              <div class="pc-result-banner" data-pm-banner hidden></div>
              <div class="pc-result-transcript-up" data-pm-transcript hidden></div>
            </div>
            <div class="pc-card-center">
              <h1 class="pc-target" data-pm-target>Loading…</h1>
              <p class="pc-romanization" data-pm-roman hidden></p>
              <p class="pc-native" data-pm-native hidden></p>
            </div>
            <div class="pc-card-below">
              <div class="pc-result-detail" data-pm-detail hidden></div>
            </div>
          </div>
        </div>

        <div class="pc-stage">
          <div class="pc-mic-wrap">
            <button class="pc-mic" data-pm-mic disabled>
              <span data-pm-mic-icon>●</span>
            </button>
            <div class="pc-mic-label" data-pm-mic-label>Loading…</div>
            <div class="pc-pm-tries-dots" data-pm-tries></div>
          </div>
          <button class="pc-pm-pass-chip is-invisible" data-pm-pass>Pass to next →</button>
        </div>

        <div class="pc-pm-splash" data-pm-splash hidden>
          <div class="pc-pm-splash-inner">
            <p class="pc-pm-splash-pre">Pass the device to</p>
            <p class="pc-pm-splash-name" data-pm-splash-name>—</p>
            <button class="pc-pm-splash-go" data-pm-splash-go>Ready</button>
          </div>
        </div>
      </div>`,(b=e.container.querySelector("[data-pm-quit]"))==null||b.addEventListener("click",async()=>{await tn({message:"Quit this game? Scores will be lost.",confirmLabel:"Quit",cancelLabel:"Keep playing",destructive:!0})&&(g(),s&&(t.cancelSession({sessionId:s}).catch(j=>console.error("[parlometron/round] cancel failed:",j)),s=null),e.onQuit())}),(R=e.container.querySelector("[data-pm-mic]"))==null||R.addEventListener("click",y),(N=e.container.querySelector("[data-pm-pass]"))==null||N.addEventListener("click",ee),(U=e.container.querySelector("[data-pm-splash-go]"))==null||U.addEventListener("click",()=>{n="ready",$()});const w=e.container.querySelector("[data-pm-target]");w&&w.addEventListener("click",()=>{const I=o==null?void 0:o.text,j=o==null?void 0:o.language_code;if(!(!I||!j))try{const H=e.hostApi.speak(j,I);H&&typeof H.catch=="function"&&H.catch(ne=>console.error("[parlometron/round] phrase speak failed:",ne))}catch(H){console.error("[parlometron/round] phrase speak threw:",H)}})},$=()=>{if(r)return;const w=xt(e.game),b=w?e.game.attemptsLeft[w.id]??0:0,R=Lt-b,N=w?e.game.currentRoundOrder.indexOf(w.id)+1:e.game.currentRoundOrder.length,U=e.game.currentRoundOrder.length,I=V=>e.container.querySelector(V),j=I("[data-pm-eyebrow]");if(j){const V=o!=null&&o.language_code?o.language_code.split("-")[0].toUpperCase():"",P=V?` · ${V}`:"";j.textContent=`Round ${e.game.currentRound}${P} · First to ${e.game.winTarget}`}const H=I("[data-pm-headline]");H&&(H.textContent=`${(w==null?void 0:w.name)??"—"}'s turn`);const ne=I("[data-pm-turn]");ne&&(ne.textContent=`${N} / ${U}`);const te=I("[data-pm-target]");te&&(te.textContent=(o==null?void 0:o.text)??"Loading…");const A=I("[data-pm-roman]");if(A){const P=!!e.hostApi.getStackConfig().showRomanization,de=((o==null?void 0:o.romanization)??"").trim();P&&de?(A.textContent=de,A.hidden=!1):A.hidden=!0}const le=I("[data-pm-native]");if(le){const V=((c==null?void 0:c.text)??"").trim();V?(le.textContent=V,le.hidden=!1):le.hidden=!0}f();const G=I("[data-pm-mic]"),F=I("[data-pm-mic-label]"),E=I("[data-pm-tries]");G&&(G.classList.remove("recording","scoring"),G.disabled=n==="scoring"||n==="loading",n==="recording"?G.classList.add("recording"):n==="scoring"&&G.classList.add("scoring")),F&&(F.textContent=n==="loading"?"Loading…":n==="passing"?`${(w==null?void 0:w.name)??"—"}, get ready`:n==="recording"?"Tap to stop":n==="scoring"?"Scoring…":n==="result"&&b>0?"Tap to try again":n==="result"?"Tap mic or pass":"Tap to speak"),E&&(E.innerHTML=Array.from({length:Lt},(V,P)=>`<span class="pc-pm-try-dot ${P<R?"used":""}"></span>`).join(""));const J=I("[data-pm-pass]");J&&J.classList.toggle("is-invisible",n!=="result");const K=I("[data-pm-splash]"),fe=I("[data-pm-splash-name]");K&&(K.hidden=n!=="passing"),fe&&(fe.textContent=(w==null?void 0:w.name)??"next player")},f=()=>{var _e;const w=e.container.querySelector("[data-pm-banner]"),b=e.container.querySelector("[data-pm-transcript]"),R=e.container.querySelector("[data-pm-detail]");if(!w||!b||!R)return;if(!d||n!=="result"){w.hidden=!0,b.hidden=!0,R.hidden=!0,w.innerHTML="",b.innerHTML="",R.innerHTML="";return}const N=d,U=Math.max(0,Math.min(1,N.overallScore)),I=Math.round(U*100),j=U>=.85?"good":U>=.6?"okay":"bad",H=j==="good"?"Nailed it":j==="okay"?"Close — try again":"";w.className=`pc-result-banner ${j}`,w.innerHTML=H?`
      <span class="pc-result-banner-score">${I}%</span>
      <span class="pc-result-banner-sep">·</span>
      <span class="pc-result-banner-text">${ct(H)}</span>`:`<span class="pc-result-banner-score">${I}%</span>`,w.hidden=!1;const ne=(N.freeText||N.text||"").trim();ne?(b.innerHTML=`
        <div class="pc-transcripts">
          <div class="pc-transcript-row heard" role="button" tabindex="0"
               data-pm-speak-heard
               aria-label="Play what Whisper heard">
            <span class="pc-transcript-label">Heard you say</span>
            <span class="pc-transcript-line">
              <span class="pc-transcript-play" aria-hidden="true">▶</span>
              <span class="pc-transcript-text">${ct(ne)}</span>
            </span>
          </div>
        </div>`,b.hidden=!1,(_e=b.querySelector("[data-pm-speak-heard]"))==null||_e.addEventListener("click",()=>{const z=o==null?void 0:o.language_code;if(z)try{const M=e.hostApi.speak(z,ne);M&&typeof M.catch=="function"&&M.catch(se=>console.error("[parlometron/round] heard speak failed:",se))}catch(M){console.error("[parlometron/round] heard speak threw:",M)}})):(b.innerHTML="",b.hidden=!0);const te=((o==null?void 0:o.text)??"").trim(),A=(o==null?void 0:o.language_code)??N.language??"",le=Xt(N.words??[]),G=rt(te),F=rt(ne),E=G.length>0&&G.length===le.length,J=G.length>0&&G.length===F.length,K=ne.length&&te.length?at(xe(ne,A),xe(te,A)):null,fe=G.length?G.map((z,M)=>({word:z,heardProb:E?le[M].probability:null,freeSim:J?at(xe(z,A),xe(F[M],A)):K})):te?[{word:te,heardProb:null,freeSim:K}]:[],V=z=>z===null?null:z>=.9?"good":z>=.6?"okay":"bad",P=z=>z===null?null:z>=.85?"good":z>=.6?"okay":"bad",de={bad:0,okay:1,good:2},Ne=z=>{const M=V(z.heardProb),se=P(z.freeSim);return M===null&&se===null?"":M===null?se:se===null||de[M]<=de[se]?M:se},he=fe.map((z,M)=>`<button class="pc-word ${Ne(z)}" type="button"
                   data-pm-word-idx="${M}"
                   aria-label="Speak ${ct(z.word)}">${ct(z.word)}</button>`).join("");R.innerHTML=he?`<div class="pc-words">${he}</div>`:"",R.hidden=!he,R.querySelectorAll("[data-pm-word-idx]").forEach(z=>{z.addEventListener("click",()=>{var je;const M=Number(z.getAttribute("data-pm-word-idx")),se=(je=fe[M])==null?void 0:je.word.trim(),ge=o==null?void 0:o.language_code;if(!(!se||!ge))try{const ve=e.hostApi.speak(ge,se);ve&&typeof ve.catch=="function"&&ve.catch(lt=>console.error("[parlometron/round] word speak failed:",lt))}catch(ve){console.error("[parlometron/round] word speak threw:",ve)}})})},y=()=>{n==="ready"?k():n==="recording"?Z():n==="result"&&p()?(d=null,n="ready",$(),k()):n==="result"&&ee()},p=()=>{const w=xt(e.game);return w?(e.game.attemptsLeft[w.id]??0)>0:!1},k=async()=>{if(r||!xt(e.game))return;const b=mr();s=b,d=null,n="recording",$();try{const R=fr((o==null?void 0:o.language_code)??"en"),N=await t.startSession({sessionId:b,language:R,expectedText:(o==null?void 0:o.text)??"",whisperParams:Wt(R)});if(r)return;if(!N.started)throw new Error("STT did not start");const U=t.subscribeAudioLevel;if(U){g();const I=b;m=Gt(j=>U(j),Ut(R),()=>{r||s===I&&(console.log("[parlometron/round] silence → stopRecording"),Z())})}}catch(R){console.error("[parlometron/round] startSession failed:",R),s=null,n="ready",$()}},Z=async()=>{if(r)return;g();const w=s;if(w){s=null,n="scoring",$();try{const b=await hr(t.stopSession({sessionId:w}),ur,"Scoring");if(r)return;const R=Math.round(Math.max(0,Math.min(1,b.overallScore))*100),N=b.text||b.freeText||"";rr(e.game,R,N),st(e.game),d=b,n="result",$()}catch(b){const R=(b==null?void 0:b.message)??String(b),N=b==null?void 0:b.code;if(console.error(`[parlometron/round] stopSession failed (code=${N??"—"}):`,R),r)return;const U=e.container.querySelector("[data-pm-banner]");if(U){const I=N==="NOT_PREPARED"||/not prepared/i.test(R)?"Speech model isn't loaded yet. Open Practice once to install it.":`Couldn't score this attempt: ${R}`;U.className="pc-result-banner bad",U.innerHTML=`<span class="pc-result-banner-text">${I.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}</span>`,U.hidden=!1}n="ready",$()}}},ee=()=>{if(!r){if(ar(e.game),st(e.game),or(e.game)){const{round:w}=cr(e.game);st(e.game),e.onRoundDone(w);return}d=null,n="passing",$()}};return(async()=>{var w,b,R;S(),n="loading",$();try{const N=e.hostApi.getStackConfig();if(!N.languages||N.languages.length<2){e.container.innerHTML=`
          <div class="pc-pm-root pc-pm-error">
            <p>Add a target language to your Corpán stack before starting Parlometron.</p>
            <button class="pc-pm-start" data-pm-quit>Back</button>
          </div>`,(w=e.container.querySelector("[data-pm-quit]"))==null||w.addEventListener("click",e.onQuit);return}const U=e.hostApi.getRandomEntry;if(!U)throw new Error("hostApi.getRandomEntry unavailable");const I=await U();if(r)return;const{target:j,native:H}=gr(I,N.languages);if(!j){e.container.innerHTML=`
          <div class="pc-pm-root pc-pm-error">
            <p>This phrase doesn't have a translation in your target language.</p>
            <button class="pc-pm-start" data-pm-quit>Back</button>
          </div>`,(b=e.container.querySelector("[data-pm-quit]"))==null||b.addEventListener("click",e.onQuit);return}o=j,c=H,nr(e.game,j.text),st(e.game),n="passing",$()}catch(N){if(console.error("[parlometron/round] boot failed:",N),r)return;e.container.innerHTML=`
        <div class="pc-pm-root pc-pm-error">
          <p>Couldn't load a phrase. Try again later.</p>
          <button class="pc-pm-start" data-pm-quit>Back</button>
        </div>`,(R=e.container.querySelector("[data-pm-quit]"))==null||R.addEventListener("click",e.onQuit)}})(),{unmount:()=>{r=!0,g(),s&&(t.cancelSession({sessionId:s}).catch(w=>console.error("[parlometron/round] unmount cancel:",w)),s=null),e.container.innerHTML=""}}},Ee=e=>e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),nn=(e,t)=>e.players.find(r=>r.id===t),yr=e=>{const{game:t,round:r}=e,n=r.winnerIds.map(d=>{var m;return((m=nn(t,d))==null?void 0:m.name)??"—"}).filter(Boolean),s=n.length===0?"No round winner.":n.length===1?`${n[0]} wins the round`:`${n.join(" & ")} tie for the round`,o=r.results.map(d=>{const m=nn(t,d.playerId),g=r.winnerIds.includes(d.playerId),S=t.roundsWon[d.playerId]??0;return`
        <tr class="${g?"winner":""}">
          <td class="pc-pm-score-name">${Ee((m==null?void 0:m.name)??"—")}</td>
          <td class="pc-pm-score-pct">${d.bestPercent}%</td>
          <td class="pc-pm-score-heard">${Ee((d.heardText||"—").slice(0,60))}</td>
          <td class="pc-pm-score-total">${S}</td>
        </tr>`}).join("");return e.container.innerHTML=`
    <div class="pc-pm-root pc-pm-results">
      <header class="pc-pm-head">
        <div class="pc-pm-head-eyebrow-row">
          <span class="pc-pm-eyebrow">Round ${r.round} · First to ${t.winTarget}</span>
        </div>
        <div class="pc-pm-head-action-row">
          <button class="pc-pm-back" data-pm-quit aria-label="Quit game">‹</button>
          <span class="pc-pm-headline">${Ee(s)}</span>
          <div class="pc-pm-head-spacer"></div>
        </div>
      </header>

      <main class="pc-pm-results-body">
        <p class="pc-pm-results-phrase">
          <span class="pc-pm-results-phrase-label">Phrase</span>
          <span class="pc-pm-results-phrase-text">${Ee(r.expectedText)}</span>
        </p>
        <table class="pc-pm-scoreboard">
          <thead>
            <tr>
              <th>Player</th>
              <th>Best %</th>
              <th>Heard</th>
              <th>Wins</th>
            </tr>
          </thead>
          <tbody>${o}</tbody>
        </table>
      </main>

      <footer class="pc-pm-results-foot">
        <button class="pc-pm-pass" data-pm-quit2>Quit</button>
        <button class="pc-pm-start" data-pm-next>Next round →</button>
      </footer>
    </div>`,(()=>{var m,g,S;const d=async()=>{await tn({message:"Quit this game?",confirmLabel:"Quit",cancelLabel:"Keep playing",destructive:!0})&&e.onQuit()};(m=e.container.querySelector("[data-pm-quit]"))==null||m.addEventListener("click",d),(g=e.container.querySelector("[data-pm-quit2]"))==null||g.addEventListener("click",d),(S=e.container.querySelector("[data-pm-next]"))==null||S.addEventListener("click",()=>e.onNextRound())})(),{unmount:()=>{e.container.innerHTML=""}}},br=e=>{var c,d;const{game:t}=e,r=ir(t),n=r.length===0?"Game over":r.length===1?`${r[0].name} wins!`:`${r.map(m=>m.name).join(" & ")} tie!`,o=[...t.players].sort((m,g)=>(t.roundsWon[g.id]??0)-(t.roundsWon[m.id]??0)).map((m,g)=>{const S=t.roundsWon[m.id]??0,$=r.some(p=>p.id===m.id),f=t.history.map(p=>p.results.find(k=>k.playerId===m.id)).filter(p=>!!p),y=f.length?Math.round(f.reduce((p,k)=>p+k.bestPercent,0)/f.length):0;return`
        <tr class="${$?"winner":""}">
          <td class="pc-pm-score-rank">${g+1}</td>
          <td class="pc-pm-score-name">${Ee(m.name)}</td>
          <td class="pc-pm-score-total">${S}</td>
          <td class="pc-pm-score-pct">${y}%</td>
        </tr>`}).join("");return e.container.innerHTML=`
    <div class="pc-pm-root pc-pm-gameover">
      <header class="pc-pm-head pc-pm-gameover-head">
        <div class="pc-pm-head-eyebrow-row">
          <span class="pc-pm-eyebrow">${Ee(`Best of ${t.winTarget*2-1}-ish · ${t.history.length} rounds played`)}</span>
        </div>
        <div class="pc-pm-head-action-row">
          <span class="pc-pm-headline pc-pm-winner">${Ee(n)}</span>
        </div>
      </header>

      <main class="pc-pm-results-body">
        <table class="pc-pm-scoreboard pc-pm-scoreboard-final">
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>Round wins</th>
              <th>Avg %</th>
            </tr>
          </thead>
          <tbody>${o}</tbody>
        </table>
      </main>

      <footer class="pc-pm-results-foot">
        <button class="pc-pm-pass" data-pm-done>Done</button>
        <button class="pc-pm-start" data-pm-again>Play again</button>
      </footer>
    </div>`,(c=e.container.querySelector("[data-pm-done]"))==null||c.addEventListener("click",()=>e.onDone()),(d=e.container.querySelector("[data-pm-again]"))==null||d.addEventListener("click",()=>e.onPlayAgain()),{unmount:()=>{e.container.innerHTML=""}}},wr="pc:parlometron:last-mode",Sr="corpan-pronunciation-coach:v2",$r=()=>{let e=null;try{const t=localStorage.getItem(Sr);if(t){const r=JSON.parse(t),n=Se(r.mode);n&&(e=n.folder)}}catch(t){console.warn("[parlometron] reading saved model failed:",t)}return e??Dt().folder},Lr=e=>{const t=e.stt;if(!(t!=null&&t.prepare))return;const r=$r();console.log("[parlometron] ensureModelPrepared — calling prepare:",r),t.prepare({model:r}).then(n=>{n.ready?console.log(`[parlometron] model ready: ${n.model??r}`):console.warn(`[parlometron] prepare reported not ready (code=${n.code??"—"}): ${n.message??""}`)}).catch(n=>{console.warn("[parlometron] prepare threw:",n)})},kr=(e,t)=>{let r=null,n=null,s=null;const o=()=>{if(r){try{r.unmount()}catch(f){console.error("[parlometron] unmount threw:",f)}r=null}},c=()=>{var f;o(),n=null,e.innerHTML=`
      <div class="pc-pm-root pc-pm-picker">
        <button class="pc-pm-picker-close" data-pm-picker-close
                aria-label="Close Parlometron">×</button>
        <header class="pc-pm-picker-head">
          <h1 class="pc-pm-brand">Parlometron</h1>
          <p class="pc-pm-brand-sub">speak. measure. repeat.</p>
        </header>
        <main class="pc-pm-picker-body">
          <button class="pc-pm-mode-card" data-pm-mode="practice">
            <span class="pc-pm-mode-title">Practice</span>
            <span class="pc-pm-mode-sub">Solo. Repeat phrases in your target language and see what the model heard.</span>
          </button>
          <button class="pc-pm-mode-card" data-pm-mode="friends">
            <span class="pc-pm-mode-title">Play with Friends</span>
            <span class="pc-pm-mode-sub">2–8 players. Same phrase, 3 tries each, highest score wins the round.</span>
          </button>
        </main>
        <footer class="pc-pm-picker-foot">
          <p class="pc-pm-picker-tagline">Pass the device. Best round wins.</p>
        </footer>
      </div>`,(f=e.querySelector("[data-pm-picker-close]"))==null||f.addEventListener("click",()=>{try{window.dispatchEvent(new CustomEvent("corpan:exit"))}catch(y){console.error("[parlometron] dispatch exit failed:",y)}}),e.querySelectorAll("[data-pm-mode]").forEach(y=>y.addEventListener("click",()=>{const p=y.getAttribute("data-pm-mode");try{localStorage.setItem(wr,p??"")}catch{}p==="practice"?d():p==="friends"&&(We(),m(s??void 0))})),r={unmount:()=>{e.innerHTML=""}}},d=()=>{o(),r=Jn(e,t,{onClose:()=>c()})},m=f=>{o(),r=pr({container:e,onBack:()=>c(),onStart:p=>{n=p,s={players:p.players.map(k=>({...k})),winTarget:p.winTarget},g()},initial:f})},g=()=>{if(!n){c();return}o(),r=vr({container:e,hostApi:t,game:n,onRoundDone:y=>{n&&(sr(n)?$():S(y))},onQuit:()=>{We(),n=null,c()}})},S=f=>{if(!n){c();return}o(),r=yr({container:e,game:n,round:f,onNextRound:()=>g(),onQuit:()=>{We(),n=null,c()}})},$=()=>{if(!n){c();return}o(),r=br({container:e,game:n,onPlayAgain:()=>{const y=s;We(),n=null,m(y??void 0)},onDone:()=>{We(),n=null,c()}})};return Lr(t),c(),{unmount:()=>{var y;o(),e.innerHTML="";const f=t.stt;(y=f==null?void 0:f.releaseAudio)==null||y.call(f).catch(p=>{console.error("[parlometron] releaseAudio failed:",p)})}}},xr="/__console",Tr="8990";function Mr(){var r,n;if(typeof document>"u")return null;const e=((n=(r=document.currentScript)==null?void 0:r.dataset)==null?void 0:n.corpGameBaseUrl)??null;if(!e)return null;let t;try{t=new URL(e)}catch{return null}return t.protocol!=="http:"?null:`${t.protocol}//${t.hostname}:${Tr}${xr}`}function Er(e){if(e==null||typeof e=="string"||typeof e=="number"||typeof e=="boolean")return e;if(e instanceof Error)return{__error:!0,name:e.name,message:e.message,stack:e.stack};try{return JSON.stringify(e),e}catch{try{return String(e)}catch{return"[unserializable]"}}}let rn=!1;function _r(){if(rn)return;const e=Mr();if(!e)return;rn=!0;const t={log:console.log.bind(console),info:console.info.bind(console),warn:console.warn.bind(console),error:console.error.bind(console)},r=(s,o)=>{try{const c=JSON.stringify({level:s,args:o.map(Er),ts:Date.now()});fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:c,keepalive:!0}).catch(()=>{})}catch{}},n=s=>(...o)=>{r(s,o),t[s](...o)};console.log=n("log"),console.info=n("info"),console.warn=n("warn"),console.error=n("error"),typeof window<"u"&&(window.addEventListener("error",s=>{r("error",["[unhandled error]",s.message,s.filename,`${s.lineno}:${s.colno}`])}),window.addEventListener("unhandledrejection",s=>{r("error",["[unhandled rejection]",String(s.reason)])})),t.log(`[devConsole] forwarding to ${e}`)}_r();const Cr="pronunciation_coach";(()=>{const e=globalThis,t=e.CorpanGames=e.CorpanGames||{};t[Cr]={mount:(r,n,s)=>{const o=globalThis;o.__pronunciationCoach&&(o.__pronunciationCoach.dispose(),o.__pronunciationCoach=void 0);const c=kr(r,n),d={dispose:()=>{c.unmount()}};return o.__pronunciationCoach=d,{unmount:()=>{d.dispose(),o.__pronunciationCoach=void 0}}}}})()})();
