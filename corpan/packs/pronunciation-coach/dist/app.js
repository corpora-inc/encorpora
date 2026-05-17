globalThis.process=globalThis.process||{env:{}};(function(){"use strict";let bt=null;const bn=6500,wn=e=>{typeof e=="number"&&Number.isFinite(e)&&e>0&&(bt=e)},Sn=()=>{if(typeof navigator>"u")return!1;const e=navigator.userAgent||"";return/iPad/.test(e)?!0:/iPhone|iPod/.test(e)?!1:!!(/Macintosh/.test(e)&&(navigator.maxTouchPoints??0)>1)},Bt=()=>bt!=null?bt>=bn:Sn(),Te=[{id:"tiny_proof",folder:"ggml-tiny.bin",label:"Tiny",shortDesc:"Tiny is, honestly, kind of terrible. You say 'good morning,' Tiny writes 'good warning.' Mostly useful as the baseline you compare bigger models against.",pros:["Tiniest download","Fast on every device","Works offline like everything here"],cons:["Frequently wrong on real sentences","Especially weak on non-Latin scripts"],approxSizeMB:75,defaultForFreshInstall:!0},{id:"small",folder:"ggml-small.bin",label:"Small",shortDesc:"First model that genuinely works for everyday Spanish, French, German, and friends. Boring, reasonable choice for Latin-script languages.",pros:["Solid for most European languages","Modest size and RAM use"],cons:["Less reliable than the Larges","Drifts on harder or longer sentences"],approxSizeMB:465,defaultForFreshInstall:!1},{id:"large_turbo",folder:"ggml-large-v3-turbo-q5_0.bin",label:"Large Turbo q5",shortDesc:"The smallest 'Large.' Whisper's speedy distilled decoder, weights crushed to 5 bits. Snappy on iPhone.",pros:["Smallest of the Large family","Fast on iOS"],cons:["Slow on Android","Distilled decoder is weaker on Telugu / Tamil / other non-Latin scripts"],approxSizeMB:547,defaultForFreshInstall:!1},{id:"large_q8",folder:"ggml-large-v3-turbo-q8_0.bin",label:"Large Turbo q8",shortDesc:"Same Turbo distillation as q5, but at 8-bit precision — math your phone's CPU prefers. Sweet spot for Android.",pros:["~2.5× faster than q5 on Android","Better quality than q5","Solid pick on iOS too"],cons:["Bigger download than q5","Same Turbo weakness on non-Latin scripts"],approxSizeMB:834,defaultForFreshInstall:!1},{id:"large_qlora",folder:"ggml-large-v3-q5_0.bin",label:"Large q5",shortDesc:"Full Whisper Large brain — no Turbo distillation — compressed to 5 bits. Best in our testing for Telugu, Tamil, Bengali, and other non-Latin-script languages.",pros:["Best for Indic and other non-Latin-script languages","Keeps the full 32-layer text decoder","Honest output in the right script"],cons:["~1 GB download","Slower than Turbo on both platforms"],approxSizeMB:1031,defaultForFreshInstall:!1},{id:"medium",folder:"ggml-medium.bin",label:"Full Weight Medium",shortDesc:"Older Whisper architecture at full precision (no compression). Wins occasionally on languages later models quietly got worse at. Usually outdone by Large q5.",pros:["Every weight at native fp16 precision","Occasionally surprises on niche languages"],cons:["Bigger download than Large q5 for usually less quality","Older architecture"],approxSizeMB:1463,defaultForFreshInstall:!1},{id:"large_max",folder:"ggml-large-v3-turbo.bin",label:"Full Weight Large Turbo",shortDesc:"Whisper's speedy Turbo distillation at full 16-bit precision. Hits Metal's fp16 fast path on iPad, so it's quick despite the size.",pros:["Fastest 'Large' on iPad (Metal fp16 fast path)","Top quality for Latin-script languages"],cons:["1.5 GB download","Same Turbo weakness on Indic — Large q5 or q8 is better for those"],approxSizeMB:1549,defaultForFreshInstall:!1},{id:"large_q8_full",folder:"ggml-large-v3-q8_0.bin",label:"Large q8 ★",shortDesc:"The biggest, baddest model that still fits on iPad — full Whisper Large at 8-bit precision (we quantize this one ourselves from the original fp16, since upstream doesn't ship it). Should be the new best for Indic and other non-Latin-script languages.",pros:["Higher precision than Large q5, same full 32-layer decoder","Expected best quality for Telugu, Tamil, Bengali, etc."],cons:["~1.6 GB download","Slower than Turbo and a bit slower than Large q5","Needs ~3 GB RAM headroom during first transcribe (iPad-class only)"],approxSizeMB:1580,defaultForFreshInstall:!1,requiresIpad:!0,downloadUrl:"https://d38iwc9748jekz.cloudfront.net/whisper-models/ggml-large-v3-q8_0.bin"}],wt=()=>Bt()?Te:Te.filter(e=>!e.requiresIpad),Ln=()=>{const e=wt();return e.find(t=>t.defaultForFreshInstall)??e[0]},$n=e=>!!e.requiresIpad&&!Bt(),ye=e=>{if(e)return Te.find(t=>t.id===e)},Ft=()=>Te.find(e=>e.defaultForFreshInstall)??Te[0],Oe={temperature:0,temperature_inc:.2,entropy_thold:2.4,logprob_thold:-1,no_speech_thold:.6,suppress_blank:!0,suppress_nst:!1,n_threads:0,initial_prompt:""},tt={te:{temperature_inc:0,initial_prompt:"నేను తెలుగు నేర్చుకుంటున్నాను. నేను ఒక పదబంధం ప్రయత్నిస్తాను, మీరు విన్నది నిజాయితీగా చెప్పండి."},ta:{temperature_inc:0,initial_prompt:"நான் தமிழ் கற்றுக்கொள்கிறேன். ஒரு சொற்றொடரை முயற்சிக்கப் போகிறேன், நீங்கள் கேட்டதை நேர்மையாகச் சொல்லுங்கள்."},ml:{temperature_inc:0,initial_prompt:"ഞാൻ മലയാളം പഠിക്കുകയാണ്. ഞാൻ ഒരു വാക്യം പറയാൻ പോകുന്നു, നിങ്ങൾ കേട്ടത് സത്യസന്ധമായി പറയൂ."},bn:{temperature_inc:0,initial_prompt:"আমি বাংলা শিখছি। আমি একটি বাক্যাংশ চেষ্টা করব, আপনি যা শুনেছেন তা সততার সাথে বলুন।"},mr:{temperature_inc:0,initial_prompt:"मी मराठी शिकत आहे. मी एक वाक्यांश प्रयत्न करणार आहे, तुम्ही ऐकलेले प्रामाणिकपणे सांगा."},gu:{temperature_inc:0,initial_prompt:"હું ગુજરાતી શીખું છું. હું એક વાક્ય બોલવાનો છું, તમે જે સાંભળ્યું તે પ્રામાણિકતાથી કહો."},pa:{temperature_inc:0,initial_prompt:"ਮੈਂ ਪੰਜਾਬੀ ਸਿੱਖ ਰਿਹਾ ਹਾਂ। ਮੈਂ ਇੱਕ ਵਾਕੰਸ਼ ਅਜ਼ਮਾਉਣ ਜਾ ਰਿਹਾ ਹਾਂ, ਤੁਸੀਂ ਜੋ ਸੁਣਿਆ ਉਹ ਇਮਾਨਦਾਰੀ ਨਾਲ ਦੱਸੋ।"},or:{temperature_inc:0,initial_prompt:"ମୁଁ ଓଡ଼ିଆ ଶିଖୁଛି। ମୁଁ ଗୋଟିଏ ଶବ୍ଦଗୁଚ୍ଛ ଚେଷ୍ଟା କରିବି, ଆପଣ ଯାହା ଶୁଣିଲେ ସତ୍ୟ ଭାବରେ କୁହନ୍ତୁ।"},as:{temperature_inc:0,initial_prompt:"মই অসমীয়া শিকি আছোঁ। মই এটা বাক্যাংশ চেষ্টা কৰিম, আপুনি যি শুনিলে সেইটো সত্যনিষ্ঠভাৱে কওক।"},ne:{temperature_inc:0,initial_prompt:"म नेपाली सिक्दैछु। म एउटा वाक्यांश प्रयास गर्ने छु, तपाईंले सुनेको कुरा इमानदारीपूर्वक भन्नुहोस्।"},si:{temperature_inc:0,initial_prompt:"මම සිංහල ඉගෙන ගන්නවා. මම වාක්‍ය ඛණ්ඩයක් උත්සාහ කරන්නම්, ඔබ ඇසූදේ අවංකව කියන්න."},fa:{temperature_inc:0,initial_prompt:"من فارسی یاد می‌گیرم. می‌خواهم یک عبارت بگویم، آنچه شنیدید را صادقانه بگویید."},ur:{temperature_inc:0,initial_prompt:"میں اردو سیکھ رہا ہوں۔ میں ایک جملہ بولنے جا رہا ہوں، جو آپ نے سنا اسے دیانتداری سے بتائیں۔"}},Wt="pc:whisper-tuning",Ee=()=>{try{const e=localStorage.getItem(Wt);if(!e)return{};const t=JSON.parse(e);return!t||typeof t!="object"?{}:t}catch(e){return console.error("[whisperTuning] loadUserOverrides failed:",e),{}}},St=e=>{try{localStorage.setItem(Wt,JSON.stringify(e))}catch(t){console.error("[whisperTuning] saveUserOverrides failed:",t)}},Lt=(e,t)=>{const r=Ee(),n=e.split("-")[0].toLowerCase(),o={...r[n]??{},...t};for(const c of Object.keys(o))o[c]===void 0&&delete o[c];Object.keys(o).length===0?delete r[n]:r[n]=o,St(r)},kn=e=>{const t=Ee(),r=e.split("-")[0].toLowerCase();delete t[r],St(t)},xn=()=>{St({})},Ut=e=>{const t=e.split("-")[0].toLowerCase(),r=tt[t]??{},n=Ee()[t]??{};return{...r,...n}},Mn={},jt=e=>{const t=e.split("-")[0].toLowerCase();return Mn[t]??{}},nt=[{key:"temperature_inc",label:"temperature_inc",min:0,max:.5,step:.05,help:"Step for the fallback ladder (0.0 → 0.2 → 0.4 → … → 1.0). 0.0 disables retries entirely — one greedy decode, deterministic."},{key:"temperature",label:"temperature",min:0,max:1.5,step:.05,help:"Initial decoding temperature. 0.0 = greedy. Raise to sample from the start (almost never want for transcription)."},{key:"entropy_thold",label:"entropy_thold",min:0,max:10,step:.1,help:"Compression-ratio-style quality gate. Higher = more permissive. Indic BPE routinely exceeds 2.4 default."},{key:"logprob_thold",label:"logprob_thold",min:-5,max:0,step:.1,help:"Avg per-token log-prob below which the decode is flagged unconfident and the fallback fires."},{key:"no_speech_thold",label:"no_speech_thold",min:0,max:1,step:.05,help:"Whisper's posterior threshold for 'this segment is silence.' Above this, the segment emits nothing."},{key:"n_threads",label:"n_threads",min:0,max:12,step:1,help:"CPU thread count. 0 = let the plugin decide (cores − 2). Higher uses more battery; lower can free the UI thread."}],rt=[{key:"suppress_blank",label:"suppress_blank",help:"Suppress blank tokens at the start of a segment."},{key:"suppress_nst",label:"suppress_nst",help:"Suppress non-speech tokens (music, noise markers). False by default."}],at=[{key:"initial_prompt",label:"initial_prompt",placeholder:"(empty)",help:"Up to ~224 tokens prepended before decoding. Bias toward a script/language; do NOT leak the expected phrase (model will parrot it). Native-script primer recommended for Indic langs."}],Tn=e=>e.split("-")[0].toLowerCase(),we=(e,t)=>t>=1?String(Math.round(e)):t>=.1?e.toFixed(1):e.toFixed(2),Fe=e=>e.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;");let le=null,ue="";const En=e=>{var s,o,c,p,f;le&&We(),ue=Tn(e);const t=document.createElement("div");t.className="pc-tuner-root",t.innerHTML=_n(ue),document.body.appendChild(t),requestAnimationFrame(()=>{t.classList.add("open")}),(s=t.querySelector("[data-pc-tuner-backdrop]"))==null||s.addEventListener("click",We),(o=t.querySelector("[data-pc-tuner-close]"))==null||o.addEventListener("click",We);const r=t.querySelector("[data-pc-tuner-handle]"),n=t.querySelector(".pc-tuner-sheet");if(r&&n){let g=0,w=0,P=!1;const d=6;r.addEventListener("pointerdown",u=>{P=!0,g=u.clientY,w=Date.now(),r.setPointerCapture(u.pointerId),n.style.transition="none"}),r.addEventListener("pointermove",u=>{if(!P)return;const x=Math.max(0,u.clientY-g);n.style.transform=`translateY(${x}px)`});const b=(u,x)=>{if(!P)return;P=!1;try{r.releasePointerCapture(u.pointerId)}catch{}const J=u.clientY-g,Z=Date.now()-w,S=Z>0?J/Z:0,W=n.offsetHeight*.15,$e=x&&(J>W||S>.5&&J>20||Math.abs(J)<d);n.style.transition="",n.style.transform="",$e&&We()};r.addEventListener("pointerup",u=>b(u,!0)),r.addEventListener("pointercancel",u=>b(u,!1))}t.addEventListener("keydown",g=>{g.key==="Escape"&&We()});for(const g of nt)In(t,g);for(const g of rt)Pn(t,g);for(const g of at)An(t,g);(c=t.querySelector("[data-pc-tuner-copy]"))==null||c.addEventListener("click",On),(p=t.querySelector("[data-pc-tuner-reset-lang]"))==null||p.addEventListener("click",Nn),(f=t.querySelector("[data-pc-tuner-reset-all]"))==null||f.addEventListener("click",zn),le=t},We=()=>{if(!le)return;const e=le;le=null,e.classList.remove("open"),window.setTimeout(()=>{e.parentNode&&e.parentNode.removeChild(e)},240)},_n=e=>{const t=tt[e]??{},r=Ee()[e]??{},n=nt.map(c=>Cn(c,t,r)).join(""),s=rt.map(c=>qn(c,t,r)).join(""),o=at.map(c=>Rn(c,t,r)).join("");return`
    <div class="pc-tuner-backdrop" data-pc-tuner-backdrop></div>
    <div class="pc-tuner-sheet" role="dialog" aria-label="Whisper tuning">
      <div class="pc-tuner-handle" data-pc-tuner-handle
           role="button" aria-label="Close tuner" tabindex="0">
        <div class="pc-tuner-handle-bar"></div>
      </div>
      <header class="pc-tuner-head">
        <div class="pc-tuner-title">
          <span class="pc-tuner-eyebrow">whisper tuning</span>
          <span class="pc-tuner-lang">${Fe(e.toUpperCase())}</span>
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
  `},Cn=(e,t,r)=>{const n=Oe[e.key]??0,s=t[e.key],o=r[e.key],c=o!==void 0?o:s!==void 0?s:n,p=o!==void 0&&o!==n,f=[];return f.push(`<span>default <b>${we(n,e.step)}</b></span>`),s!==void 0&&f.push(`<span>built-in <b>${we(s,e.step)}</b></span>`),p&&f.push('<span class="pc-tuner-modified">modified</span>'),`
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
               value="${we(c,e.step)}"
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
        ${f.join('<span class="pc-tuner-sep">·</span>')}
      </div>
      <p class="pc-tuner-help">${e.help}</p>
    </div>
  `},qn=(e,t,r)=>{const n=Oe[e.key],s=t[e.key],o=r[e.key],c=o!==void 0?o:s!==void 0?s:n,p=o!==void 0&&o!==n;return`
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
        ${p?`<span class="pc-tuner-sep">·</span>
               <span class="pc-tuner-modified">modified</span>`:""}
      </div>
      <p class="pc-tuner-help">${e.help}</p>
    </div>
  `},Rn=(e,t,r)=>{const n=t[e.key],s=r[e.key],o=s!==void 0?s:n!==void 0?n:"",c=s!==void 0&&s!==(n??""),p=[];return n&&n.length>0?p.push(`<span>built-in <b>"${Fe(n)}"</b></span>`):p.push("<span>default <b>(empty)</b></span>"),c&&p.push('<span class="pc-tuner-modified">modified</span>'),`
    <div class="pc-tuner-row pc-tuner-row-text" data-pc-row="${e.key}">
      <div class="pc-tuner-row-head">
        <label class="pc-tuner-row-label" for="pc-tuner-text-${e.key}">
          ${e.label}
        </label>
      </div>
      <textarea id="pc-tuner-text-${e.key}"
                class="pc-tuner-text"
                rows="2"
                placeholder="${Fe(e.placeholder)}"
                data-pc-tuner-text="${e.key}"
                spellcheck="false"
                autocapitalize="off"
                autocorrect="off">${Fe(o)}</textarea>
      <div class="pc-tuner-row-trail">
        ${p.join('<span class="pc-tuner-sep">·</span>')}
      </div>
      <p class="pc-tuner-help">${e.help}</p>
    </div>
  `},In=(e,t)=>{const r=e.querySelector(`[data-pc-tuner-slider="${t.key}"]`),n=e.querySelector(`[data-pc-tuner-num="${t.key}"]`);if(!r||!n)return;const s=o=>{const c=parseFloat(o);if(Number.isNaN(c))return;const p=Math.min(t.max,Math.max(t.min,c));Lt(ue,{[t.key]:p}),r.value=String(p),n.value=we(p,t.step),Ne(e,t.key)};r.addEventListener("input",()=>{n.value=we(parseFloat(r.value),t.step)}),r.addEventListener("change",()=>s(r.value)),n.addEventListener("change",()=>s(n.value))},Pn=(e,t)=>{const r=e.querySelector(`[data-pc-tuner-bool="${t.key}"]`);r&&r.addEventListener("change",()=>{Lt(ue,{[t.key]:r.checked}),Ne(e,t.key)})},An=(e,t)=>{const r=e.querySelector(`[data-pc-tuner-text="${t.key}"]`);if(!r)return;const n=()=>{const s=r.value;Lt(ue,{[t.key]:s.length>0?s:void 0}),Ne(e,t.key)};r.addEventListener("blur",n),r.addEventListener("keydown",s=>{s.key==="Enter"&&!(s.metaKey||s.ctrlKey||s.shiftKey)&&(s.preventDefault(),r.blur())})},Ne=(e,t)=>{const r=tt[ue]??{},n=Ee()[ue]??{},s=e.querySelector(`[data-pc-row="${t}"]`);if(!s)return;const o=s.querySelector(".pc-tuner-row-trail");if(!o)return;const c=nt.find(g=>g.key===t);if(c){const g=Oe[t]??0,w=r[t],P=n[t],d=P!==void 0&&P!==g,b=[`<span>default <b>${we(g,c.step)}</b></span>`];w!==void 0&&b.push(`<span>built-in <b>${we(w,c.step)}</b></span>`),d&&b.push('<span class="pc-tuner-modified">modified</span>'),o.innerHTML=b.join('<span class="pc-tuner-sep">·</span>');return}if(rt.find(g=>g.key===t)){const g=Oe[t],w=r[t],P=n[t],d=P!==void 0&&P!==g,b=[`<span>default <b>${g?"on":"off"}</b></span>`];w!==void 0&&b.push(`<span>built-in <b>${w?"on":"off"}</b></span>`),d&&b.push('<span class="pc-tuner-modified">modified</span>'),o.innerHTML=b.join('<span class="pc-tuner-sep">·</span>');return}if(at.find(g=>g.key===t)){const g=r[t],w=n[t],P=w!==void 0&&w!==(g??""),d=[];g&&g.length>0?d.push(`<span>built-in <b>"${Fe(g)}"</b></span>`):d.push("<span>default <b>(empty)</b></span>"),P&&d.push('<span class="pc-tuner-modified">modified</span>'),o.innerHTML=d.join('<span class="pc-tuner-sep">·</span>')}},On=async()=>{var t;const e=JSON.stringify(Ee(),null,2);try{await((t=navigator.clipboard)==null?void 0:t.writeText(e)),ot(`Copied (${e.length} chars)`)}catch(r){console.error("[whisperTunerUI] clipboard write failed:",r),ot("Copy failed — see console")}},Gt=e=>{const t=tt[ue]??{},r=Ee()[ue]??{};for(const n of nt){const s=Oe[n.key]??0,o=r[n.key]!==void 0?r[n.key]:t[n.key]!==void 0?t[n.key]:s,c=e.querySelector(`[data-pc-tuner-slider="${n.key}"]`),p=e.querySelector(`[data-pc-tuner-num="${n.key}"]`);c&&(c.value=String(o)),p&&(p.value=we(o,n.step)),Ne(e,n.key)}for(const n of rt){const s=Oe[n.key],o=r[n.key]!==void 0?r[n.key]:t[n.key]!==void 0?t[n.key]:s,c=e.querySelector(`[data-pc-tuner-bool="${n.key}"]`);c&&(c.checked=o),Ne(e,n.key)}for(const n of at){const s=r[n.key]!==void 0?r[n.key]:t[n.key]!==void 0?t[n.key]:"",o=e.querySelector(`[data-pc-tuner-text="${n.key}"]`);o&&(o.value=s),Ne(e,n.key)}},Nn=()=>{le&&(kn(ue),Gt(le),ot("Reset to built-in"))},zn=()=>{le&&(xn(),Gt(le),ot("All languages reset"))},ot=e=>{if(!le)return;const t=le.querySelector(".pc-tuner-foot");if(!t)return;const r=document.createElement("div");r.className="pc-tuner-flash",r.textContent=e,t.appendChild(r),window.setTimeout(()=>{r.parentNode&&r.parentNode.removeChild(r)},1600)},Hn={rmsThreshold:.012,speechStartMs:120,silenceMs:1500,leadInMs:250},Yt=(e,t,r)=>{const n={...Hn,...t};let s=!1,o=null,c=null,p=null,f=null,g=!1,w=!1;try{w=localStorage.getItem("pc:silence-debug")==="1"}catch{}const P=()=>{if(s)return;s=!0;const u=o;if(o=null,u)try{u()}catch(x){console.error("[silence-watcher] unsubscribe threw:",x)}},d=()=>{if(!s){P();try{r()}catch(u){console.error("[silence-watcher] onSilence threw:",u)}}},b=u=>{if(s||(g||(g=!0,console.log(`[silence-watcher] first audio_level event: rms=${u.rms.toFixed(4)} t=${u.t}ms (policy: rmsThreshold=${n.rmsThreshold}, speechStartMs=${n.speechStartMs}, silenceMs=${n.silenceMs}, leadInMs=${n.leadInMs})`)),w&&console.log(`[silence-watcher] rms=${u.rms.toFixed(4)} t=${u.t}ms state=${p===null?"waiting":"speaking"}`),u.t<n.leadInMs))return;const x=u.rms>=n.rmsThreshold;if(p===null){x?(c===null&&(c=u.t),u.t-c>=n.speechStartMs&&(p=u.t,f=null,console.log(`[silence-watcher] speech detected at t=${u.t}ms rms=${u.rms.toFixed(4)}`))):c=null;return}if(x){f=null;return}f===null&&(f=u.t),u.t-f>=n.silenceMs&&(console.log(`[silence-watcher] auto-stop at t=${u.t}ms (quiet for ${u.t-f}ms after speech)`),d())};return console.log("[silence-watcher] subscribing to audio_level…"),e(b).then(u=>{if(console.log("[silence-watcher] subscribed; waiting for first event"),s){try{u()}catch(x){console.error("[silence-watcher] late unsubscribe threw:",x)}return}o=u}).catch(u=>{console.warn("[silence-watcher] subscribe failed; auto-stop disabled:",(u==null?void 0:u.message)||u)}),{stop:P}},$t=e=>{if(e&&typeof e=="object"){const t=e.code;if(typeof t=="string")return t}},me=e=>{if(e==null)return"(unknown error)";if(typeof e=="string")return e;if(e instanceof Error)return e.message||e.name||String(e);if(typeof e=="object"){const t=e,r=[t.message,t.localizedDescription,t.error,t.description,t.detail];for(const n of r)if(typeof n=="string"&&n.length>0)return n;try{const n=JSON.stringify(e);if(n&&n!=="{}")return n}catch{}}return String(e)},Dn=70,Bn=.4,kt="corpan-pronunciation-coach:v2",Kt="corpan-pronunciation-coach:v1",Fn=50,Se=e=>{var t;return((t=ye(e))==null?void 0:t.folder)??e},ne=e=>{var t;return((t=ye(e))==null?void 0:t.label)??e},Wn=e=>{const t=ye(e);return t&&t.approxSizeMB>=1e3?18e4:6e4},Un=9e4,Vt=async(e,t,r)=>{let n=null;const s=new Promise((o,c)=>{n=setTimeout(()=>{c(new Error(`${r} timed out after ${Math.round(t/1e3)}s`))},t)});try{return await Promise.race([e,s])}finally{n&&clearTimeout(n)}},jn=e=>{var t,r,n;return{entryId:e.entry.entry_id,level:e.entry.level,domains:e.entry.domains??[],targetLang:e.targetLang,targetText:e.target.text,targetRoman:e.target.romanization??"",nativeLang:((t=e.native)==null?void 0:t.language_code)??null,nativeText:((r=e.native)==null?void 0:r.text)??"",nativeRoman:((n=e.native)==null?void 0:n.romanization)??""}},Gn=e=>({entry:{entry_id:e.entryId,level:e.level,domains:e.domains,translations:[]},target:{language_code:e.targetLang,text:e.targetText,romanization:e.targetRoman},native:e.nativeLang?{language_code:e.nativeLang,text:e.nativeText,romanization:e.nativeRoman}:null,targetLang:e.targetLang}),Xt=/[''']/,Yn={en:{zero:"0",one:"1",two:"2",three:"3",four:"4",five:"5",six:"6",seven:"7",eight:"8",nine:"9",ten:"10",eleven:"11",twelve:"12",thirteen:"13",fourteen:"14",fifteen:"15",sixteen:"16",seventeen:"17",eighteen:"18",nineteen:"19",twenty:"20",thirty:"30",forty:"40",fifty:"50",sixty:"60",seventy:"70",eighty:"80",ninety:"90",hundred:"100",thousand:"1000"},es:{cero:"0",uno:"1",una:"1",dos:"2",tres:"3",cuatro:"4",cinco:"5",seis:"6",siete:"7",ocho:"8",nueve:"9",diez:"10",once:"11",doce:"12",trece:"13",catorce:"14",quince:"15",dieciséis:"16",dieciseis:"16",diecisiete:"17",dieciocho:"18",diecinueve:"19",veinte:"20",treinta:"30",cuarenta:"40",cincuenta:"50",sesenta:"60",setenta:"70",ochenta:"80",noventa:"90",cien:"100",ciento:"100",mil:"1000"},fr:{zéro:"0",zero:"0",un:"1",une:"1",deux:"2",trois:"3",quatre:"4",cinq:"5",six:"6",sept:"7",huit:"8",neuf:"9",dix:"10",onze:"11",douze:"12",treize:"13",quatorze:"14",quinze:"15",seize:"16",vingt:"20",trente:"30",quarante:"40",cinquante:"50",soixante:"60",cent:"100",mille:"1000"},it:{zero:"0",uno:"1",una:"1",due:"2",tre:"3",quattro:"4",cinque:"5",sei:"6",sette:"7",otto:"8",nove:"9",dieci:"10",undici:"11",dodici:"12",tredici:"13",quattordici:"14",quindici:"15",sedici:"16",diciassette:"17",diciotto:"18",diciannove:"19",venti:"20",trenta:"30",quaranta:"40",cinquanta:"50",sessanta:"60",settanta:"70",ottanta:"80",novanta:"90",cento:"100",mille:"1000"},de:{null:"0",eins:"1",ein:"1",eine:"1",zwei:"2",drei:"3",vier:"4",fünf:"5",funf:"5",sechs:"6",sieben:"7",acht:"8",neun:"9",zehn:"10",elf:"11",zwölf:"12",zwolf:"12",dreizehn:"13",vierzehn:"14",fünfzehn:"15",funfzehn:"15",sechzehn:"16",siebzehn:"17",achtzehn:"18",neunzehn:"19",zwanzig:"20",dreißig:"30",dreissig:"30",vierzig:"40",fünfzig:"50",funfzig:"50",sechzig:"60",siebzig:"70",achtzig:"80",neunzig:"90",hundert:"100",tausend:"1000"},pt:{zero:"0",um:"1",uma:"1",dois:"2",duas:"2",três:"3",tres:"3",quatro:"4",cinco:"5",seis:"6",sete:"7",oito:"8",nove:"9",dez:"10",onze:"11",doze:"12",treze:"13",catorze:"14",quatorze:"14",quinze:"15",dezesseis:"16",dezasseis:"16",dezessete:"17",dezassete:"17",dezoito:"18",dezenove:"19",dezanove:"19",vinte:"20",trinta:"30",quarenta:"40",cinquenta:"50",sessenta:"60",setenta:"70",oitenta:"80",noventa:"90",cem:"100",cento:"100",mil:"1000"}},Kn=new Set(["te","ta","bn","ml","mr","gu","pa","ur","fa","si","ne","or","as"]),Le=(e,t)=>{const r=e.normalize("NFC").toLowerCase().replace(/[\p{P}\p{S}\p{C}]/gu,"").replace(/\s+/g," ").trim();if(!r)return r;const n=(t??"").toLowerCase().split("-")[0],s=Yn[n];return s?r.split(" ").map(o=>s[o]??o).join(" "):r},Vn=/[぀-ゟ゠-ヿ㐀-䶿一-鿿豈-﫿가-힯]/,st=e=>{const t=e.trim();if(!t)return[];if(/\s/.test(t))return t.split(/\s+/).filter(Boolean);if(Vn.test(t)){const r=Intl.Segmenter;if(typeof r=="function"){const n=new r(void 0,{granularity:"grapheme"});return Array.from(n.segment(t),s=>s.segment).filter(s=>s.trim().length>0)}return Array.from(t).filter(n=>n.trim().length>0)}return[t]},it=(e,t)=>{const r=Array.from(e),n=Array.from(t),s=r.length,o=n.length;if(s===0&&o===0)return 1;if(s===0||o===0)return 0;let c=new Array(o+1),p=new Array(o+1);for(let f=0;f<=o;f++)c[f]=f;for(let f=1;f<=s;f++){p[0]=f;for(let w=1;w<=o;w++)p[w]=r[f-1]===n[w-1]?c[w-1]:1+Math.min(c[w],p[w-1],c[w-1]);const g=c;c=p,p=g}return 1-c[o]/Math.max(s,o)},Qt=e=>{if(!e||e.length===0)return[];const t=[];for(const r of e){const n=t[t.length-1];if(n){const s=n.word.replace(/\s+$/,"").slice(-1),o=r.word.replace(/^\s+/,"").charAt(0),c=Xt.test(s),p=Xt.test(o);if(c||p){n.word=n.word+r.word.replace(/^\s+/,""),n.endMs=Math.max(n.endMs,r.endMs),n.probability=Math.min(n.probability,r.probability);continue}}t.push({...r})}return t},Xn=()=>{try{const e=window.localStorage,t="__pc_probe__";return e.setItem(t,"1"),e.removeItem(t),e}catch{return null}},Jt=e=>{if(!e)return null;try{const t=JSON.parse(e);return typeof t!="object"||t===null||!Array.isArray(t.phrases)||typeof t.idx!="number"||typeof t.streak!="number"?null:t}catch(t){return console.error("[pronunciation-coach] localStorage parse failed:",t),null}},Zt=e=>{if(!e)return null;const t=Jt(e.getItem(kt));if(t)return t;const r=Jt(e.getItem(Kt));if(!r)return null;const n={...r,mode:r.mode==="standard"?"standard":void 0};try{e.setItem(kt,JSON.stringify(n)),e.removeItem(Kt),console.log("[pronunciation-coach] migrated v1 → v2 storage, mode preserved:",n.mode??"(cleared)")}catch(s){console.error("[pronunciation-coach] storage migration failed:",s)}return n},Qn=()=>{try{const e=globalThis.crypto;if(e&&typeof e.randomUUID=="function")return e.randomUUID()}catch(e){console.error("[pronunciation-coach] randomUUID failed:",e)}return`pc-${Date.now()}-${Math.floor(Math.random()*1e9)}`},en=e=>e?e.split("-")[0].toLowerCase():"en",Jn=e=>{const t=[...e];for(let r=t.length-1;r>0;r--){const n=Math.floor(Math.random()*(r+1));[t[r],t[n]]=[t[n],t[r]]}return t},Zn=(e,t)=>{const r=t.length>0?e.translations.find(o=>o.language_code===t[0])??null:null;let n=null;const s=Jn(t.slice(1));for(const o of s){const c=e.translations.find(p=>p.language_code===o);if(c){n=c;break}}return n||(n=e.translations.find(o=>!r||o.language_code!==r.language_code)??null),{target:n,native:r}},Y=e=>e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"),ct=()=>{try{window.dispatchEvent(new CustomEvent("corpan:exit"))}catch(e){console.error("[pronunciation-coach] dispatch exit failed:",e)}},er=e=>{const t=document.createElement("div");t.className="pc-confetti";const r=["#7c3aed","#16a34a","#facc15","#ec4899","#06b6d4"],n=32;for(let s=0;s<n;s++){const o=document.createElement("span");o.style.left=`${Math.random()*100}%`,o.style.background=r[s%r.length],o.style.animationDelay=`${Math.random()*200}ms`,o.style.animationDuration=`${900+Math.random()*600}ms`,o.style.transform=`rotate(${Math.random()*360}deg)`,t.appendChild(o)}e.appendChild(t),window.setTimeout(()=>t.remove(),1800)},tr=(e,t,r)=>{const n=t.stt;let s=!1,o=null,c=null;const p=()=>{c&&(c.stop(),c=null)},f=document.querySelector('meta[name="viewport"]'),g=(f==null?void 0:f.getAttribute("content"))??null;f&&f.setAttribute("content","width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover");const w=()=>{f&&g!==null&&f.setAttribute("content",g)},P=(a="Speech recognition isn't available on this device",i="Parlometron needs the on-device Whisper plugin and didn't find a working one here. Try updating the app, or this platform may not be supported yet.")=>{var l;e.innerHTML=`
      <div class="pc-root">
        <div class="pc-header">
          <div class="pc-header-left"></div>
          <div class="pc-header-right">
            <button class="pc-close" id="pc-close" type="button" aria-label="Close">×</button>
          </div>
        </div>
        <div class="pc-unavailable">
          <h2>${Y(a)}</h2>
          <p>${Y(i)}</p>
        </div>
      </div>
    `,(l=e.querySelector("#pc-close"))==null||l.addEventListener("click",ct)};if(!n)return P(),{unmount:()=>{w(),e.innerHTML=""}};e.innerHTML=`
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
  `;const d=e.querySelector("#pc-close"),b=e.querySelector("#pc-streak"),u=e.querySelector("#pc-streak-n"),x=e.querySelector("#pc-mode"),J=e.querySelector("#pc-swipe-area"),Z=e.querySelector("#pc-deck");let S=e.querySelector("#pc-card");const W=e.querySelector("#pc-mic"),$e=e.querySelector("#pc-mic-icon"),v=e.querySelector("#pc-mic-label"),L=a=>a.querySelector("[data-pc-result-banner]"),C=a=>a.querySelector("[data-pc-result-transcript-up]"),z=a=>a.querySelector("[data-pc-result-bars-up]"),ee=a=>a.querySelector("[data-pc-result-detail]"),O=e.querySelector("#pc-error");let A=null;const K=a=>{A||(A=document.createElement("div"),A.className="pc-overlay",A.innerHTML='<div class="pc-spinner"></div><div id="pc-overlay-msg"></div>',document.body.appendChild(A));const i=A.querySelector("#pc-overlay-msg");i&&(i.textContent=a)},U=()=>{A&&A.parentNode&&A.parentNode.removeChild(A),A=null},H=a=>{O.textContent=a,O.hidden=!1,console.error("[pronunciation-coach]",a)},oe=()=>{O.textContent="",O.hidden=!0};let te="idle",q=!1,T=null;const V=[];let X=-1,fe=null,se=0,_=Ft().id,ce=!1;const de=Xn(),ke=()=>{if(de)try{const a=Math.max(0,V.length-Fn),i=V.slice(a).map(jn),l=X-a,h={streak:se,phrases:i,idx:l,mode:_};de.setItem(kt,JSON.stringify(h))}catch(a){console.error("[pronunciation-coach] persist failed:",a)}},xe=()=>{const a=ye(_);x.setAttribute("aria-pressed",_==="advanced"?"true":"false"),x.classList.toggle("advanced",_==="advanced"),x.disabled=ce;const i=a?`${a.label} model (~${a.approxSizeMB} MB) · tap to switch`:`${ne(_)} model · tap to switch`;x.title=i,x.setAttribute("aria-label",`Speech model: ${ne(_)}`);const l=e.querySelector("#pc-footer-model");l&&(l.textContent=ne(_))},Ye=()=>{se<=0?b.hidden=!0:(u.textContent=String(se),b.hidden=!1)},$=a=>{te=a,W.classList.remove("recording","scoring"),W.disabled=!1,a==="idle"?($e.innerHTML="●",v.textContent=q?"Tap to speak":"Loading model…",W.disabled=!q||!T):a==="recording"?(W.classList.add("recording"),$e.innerHTML="■",v.textContent="Listening… tap to stop"):a==="scoring"&&(W.classList.add("scoring"),$e.innerHTML='<div class="pc-spinner"></div>',v.textContent="Scoring…",W.disabled=!0)},F=(a,i,l)=>`
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
  `,Q=e.querySelector("#pc-lang-badge"),Ke=a=>{if(!a){Q.hidden=!0,Q.textContent="—",Q.setAttribute("data-pc-lang","");return}const i=en(a);Q.hidden=!1,Q.textContent=i.toUpperCase(),Q.setAttribute("data-pc-lang",i),Q.setAttribute("aria-label",`Target language ${i.toUpperCase()} — long-press to tune Whisper`)},Ce=(a,i)=>{var R;const h=!!t.getStackConfig().showRomanization,y=i.target.romanization||"",k=h&&y?`<p class="pc-romanization">${Y(y)}</p>`:"",B=(R=i.native)!=null&&R.text?`<p class="pc-native">${Y(i.native.text)}</p>`:"";a.innerHTML=F(`<h1 class="pc-target">${Y(i.target.text||"—")}</h1>`,k,B),Ke(i.targetLang)},Me=(a,i,l)=>{a.innerHTML=F(`<h1 class="pc-target">${Y(i)}</h1>`,"",`<p class="pc-native">${Y(l)}</p>`),Ke(null)},pt=()=>{T&&Ce(S,T)},_t=async(a,i)=>{const l=Z.clientWidth||window.innerWidth,h=a==="left"?-1:1;S.style.transition="transform 220ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 200ms ease",S.style.transform=`translateX(${h*l}px)`,S.style.opacity="0",await new Promise(k=>window.setTimeout(k,220));const y=document.createElement("div");y.className="pc-card entering",y.id="pc-card",y.style.transition="none",y.style.transform=`translateX(${-h*l}px)`,y.style.opacity="0",i(y),Z.replaceChild(y,S),S=y,S.offsetWidth,S.style.transition="transform 280ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 240ms ease",S.style.transform="translateX(0)",S.style.opacity="1",S.classList.remove("entering"),S.classList.add("entered")},Ct=async()=>{const a=t.getStackConfig();if(!a.languages||a.languages.length<2||!t.getRandomEntry)return null;const i=await t.getRandomEntry(),{target:l,native:h}=Zn(i,a.languages);return l?{entry:i,target:l,native:h,targetLang:l.language_code}:null},qt=()=>{fe||s||Ct().then(a=>{!s&&a&&(fe=a)}).catch(a=>{console.error("[pronunciation-coach] prefetch failed:",a)})},sn=async()=>{if(te==="scoring")return;Ve(),oe();const a=t.getStackConfig();if(!a.languages||a.languages.length<2){T=null,Me(S,"Set up at least one target language","Open Corpán settings and add a target language to start practising."),W.disabled=!0,v.textContent="—";return}if(X>=0&&X<V.length-1){const l=V[X+1];X+=1,await _t("left",h=>Ce(h,l)),T=l,$("idle"),ke();return}let i=fe;if(fe=null,!i)try{i=await Ct()}catch(l){console.error("[pronunciation-coach] fetch next failed:",l),H(`Could not load a phrase: ${me(l)}`);return}if(!i){H("No phrases available — check your stack config.");return}V.push(i),X=V.length-1,await _t("left",l=>Ce(l,i)),T=i,$("idle"),ke(),qt()},cn=async()=>{if(te==="scoring"||X<=0)return;Ve(),oe();const a=V[X-1];X-=1,await _t("right",i=>Ce(i,a)),T=a,$("idle"),ke()},Ir=a=>{const i=L(a),l=C(a),h=z(a),y=ee(a),k=()=>{i&&(i.innerHTML="",i.hidden=!0,i.className="pc-result-banner"),l&&(l.innerHTML="",l.hidden=!0,l.className="pc-result-transcript-up"),h&&(h.innerHTML="",h.hidden=!0,h.className="pc-result-bars-up"),y&&(y.innerHTML="",y.hidden=!0,y.className="pc-result-detail")};if(!(i&&!i.hidden||l&&!l.hidden||h&&!h.hidden||y&&!y.hidden)){k();return}i&&!i.hidden&&i.classList.add("leaving"),l&&!l.hidden&&l.classList.add("leaving"),h&&!h.hidden&&h.classList.add("leaving"),y&&!y.hidden&&y.classList.add("leaving"),window.setTimeout(k,220)},Pr=()=>Ir(S),Ar=a=>{const i=Math.max(0,Math.min(1,a.overallScore)),l=Math.max(0,Math.min(1,a.noSpeechProb??0)),h=a.compressionRatio??0,y=Math.max(0,Math.min(1,a.freeVsConstrainedSimilarity??1)),k=N=>`${Math.round(N*100)}%`,B=l>.5;let R="bad",D="Try again";B?(R="bad",D="🎙️ Couldn't hear you"):i>=.95?(R="good",D="✨ Perfect!"):i>=.85?(R="good",D="🎉 Nailed it!"):i>=.75?(R="good",D="Great"):i>=.6?(R="okay",D="Pretty good"):i>=.45?(R="okay",D="Close — keep going"):i>=.25&&(R="bad",D="Keep practicing"),B||(i>=.85?(se+=1,er(document.body)):i>=.6||(se=0)),Ye(),ke();const be=Qt(a.words||[]),M=((T==null?void 0:T.target.text)||"").trim(),he=st(M),ge=(a.freeText||"").trim(),ht=st(ge),gt=he.length>0&&he.length===be.length,et=he.length>0&&he.length===ht.length,m=M.length>0&&ge.length===0,E=(T==null?void 0:T.targetLang)||a.language||"",j=ge.length&&M.length?it(Le(ge,E),Le(M,E)):m?0:null,I=he.length?he.map((N,G)=>({word:N,heardProb:gt?be[G].probability:null,freeSim:et?it(Le(N,E),Le(ht[G],E)):j})):M?[{word:M,heardProb:null,freeSim:j}]:[],ae=N=>N===null?null:N>=.9?"good":N>=.6?"okay":"bad",re=N=>N===null?null:N>=.85?"good":N>=.6?"okay":"bad",ve={bad:0,okay:1,good:2},qe=N=>{const G=ae(N.heardProb),ie=re(N.freeSim);return G===null&&ie===null?"":G===null?ie:ie===null||ve[G]<=ve[ie]?G:ie},Re=I.map((N,G)=>`<button class="pc-word ${qe(N)}" type="button" data-pc-word-idx="${G}" aria-label="Speak ${Y(N.word)}">${Y(N.word)}</button>`).join(""),vt=ge.length?`<div class="pc-transcript-row heard" role="button" tabindex="0"
             data-pc-speak="heard" data-no-swipe
             aria-label="Play what Whisper heard">
           <span class="pc-transcript-label">Heard you say</span>
           <span class="pc-transcript-line">
             <span class="pc-transcript-play" aria-hidden="true">▶</span>
             <span class="pc-transcript-text">${Y(ge)}</span>
           </span>
         </div>`:m?`<div class="pc-transcript-row heard empty">
             <span class="pc-transcript-label">Heard you say</span>
             <span class="pc-transcript-line">
               <span class="pc-transcript-text empty">(couldn't make out the words)</span>
             </span>
           </div>`:"",yt=vt?`<div class="pc-transcripts">${vt}</div>`:"",zt={"pa-arab":"Different writing system — scoring may be off","yue-hant-hk":"Different writing system — scoring may be off","zh-hans":"Different writing system — scoring may be off","zh-hant":"Different writing system — scoring may be off"},Ie=(a.language??"").toLowerCase(),vn=zt[Ie],Pe=[];l>.2&&Pe.push('<div class="pc-chip pc-chip-warn">Sounded faint — try a bit louder</div>');const Wr=E.toLowerCase().split("-")[0],Ur=Kn.has(Wr)?3.5:2.4;h>Ur&&Pe.push('<div class="pc-chip pc-chip-warn">Sounded a bit garbled</div>'),m?Pe.push(`<div class="pc-chip pc-chip-warn">Couldn't make out the words</div>`):y<.6&&Pe.push(`<div class="pc-chip pc-chip-warn">Words didn't quite match</div>`),vn&&Pe.push(`<div class="pc-chip">${Y(vn)}</div>`);const jr=Pe.length?`<div class="pc-chips pc-diagnostics">${Pe.join("")}</div>`:"",Ae=L(S),Ht=C(S),Dt=z(S),Be=ee(S);if(!Ae||!Be){console.error("[pronunciation-coach] renderResult: card missing result slots");return}B?(Ae.className=`pc-result-banner ${R}`,Ae.innerHTML=`
        <span class="pc-result-banner-score">—</span>
        <span class="pc-result-banner-sep">·</span>
        <span class="pc-result-banner-text">${D}</span>
      `,Ae.hidden=!1,Be.innerHTML=`
        <div class="pc-chips">
          <div class="pc-chip">Move the device closer or speak louder.</div>
        </div>
      `,Be.hidden=!1):(Ae.className=`pc-result-banner ${R}`,Ae.innerHTML=`
        <span class="pc-result-banner-score">${k(i)}</span>
        <span class="pc-result-banner-sep">·</span>
        <span class="pc-result-banner-text">${D}</span>
      `,Ae.hidden=!1,Ht&&(Ht.innerHTML=yt,Ht.hidden=!yt),Dt&&(Dt.innerHTML="",Dt.hidden=!0),Be.innerHTML=`
        ${Re?`<div class="pc-words">${Re}</div>`:""}
        ${jr}
      `,Be.hidden=!1);const yn=(N,G)=>{const ie=(T==null?void 0:T.targetLang)||a.language||"en";try{const pe=t.speak(ie,N);pe&&typeof pe.catch=="function"&&pe.catch(Gr=>{console.error(`[pronunciation-coach] ${G} speak failed:`,Gr)})}catch(pe){console.error(`[pronunciation-coach] ${G} speak threw:`,pe)}};Be.querySelectorAll("button.pc-word[data-pc-word-idx]").forEach(N=>{N.addEventListener("click",()=>{const G=N.getAttribute("data-pc-word-idx");if(G===null)return;const ie=Number(G),pe=I[ie];pe&&yn(pe.word.trim(),"word")})}),S.querySelectorAll(".pc-transcript-row[data-pc-speak]").forEach(N=>{const G=()=>{ge&&yn(ge,"heard")};N.addEventListener("click",G),N.addEventListener("keydown",ie=>{const pe=ie.key;(pe==="Enter"||pe===" ")&&(ie.preventDefault(),G())})})},Ve=()=>{p();const a=o;o=null,a&&n.cancelSession({sessionId:a}).catch(i=>{console.error("[pronunciation-coach] cancelSession failed:",i)})},ln=async()=>{if(!T||!q)return;oe(),Pr();const a=Qn();o=a;try{$("recording");const i=en(T.targetLang),l=await n.startSession({sessionId:a,language:i,expectedText:T.target.text,whisperParams:Ut(i)});if(s)return;if(!l.started)throw new Error("STT plugin reported started=false");const h=n.subscribeAudioLevel;if(h){p();const y=a;c=Yt(k=>h(k),jt(i),()=>{s||o===y&&(console.log("[pronunciation-coach] silence → stopRecording"),It())})}}catch(i){console.error("[pronunciation-coach] startSession failed:",i),o=null,H(`Could not start recording: ${me(i)}`),$("idle")}},Rt=async a=>{if(!n)throw new Error("STT unavailable");const i=Se(a),l=await Vt(n.prepare({model:i}),Wn(a),`Loading ${ne(a)} model`);if(!l.ready){const h=new Error(l.message||"Model not ready");throw h.code=l.code,h}return l},It=async()=>{p();const a=o;if(!a){$("idle");return}o=null;try{$("scoring");const i=await Vt(n.stopSession({sessionId:a}),Un,"Scoring");if(s)return;Ar(i),$("idle")}catch(i){const l=me(i),h=$t(i);if(console.error(`[pronunciation-coach] stopSession failed (code=${h??"—"}):`,l),$("idle"),h==="LOAD_FAILED"){q=!1,W.disabled=!0,v.textContent="Model needs reinstall",H(`${ne(_)} model failed to load — opening setup so you can reinstall.`),Pt().catch(y=>{console.error("[pronunciation-coach] openModelSetup after LOAD_FAILED:",y)});return}if(h==="NETWORK"){H("Network hiccup while scoring. Try again — your model is fine.");return}H(`Scoring failed: ${l}`)}};W.addEventListener("click",()=>{te==="idle"?ln().catch(a=>{console.error("[pronunciation-coach] startRecording threw:",a)}):te==="recording"&&It().catch(a=>{console.error("[pronunciation-coach] stopRecording threw:",a)})}),d.addEventListener("click",()=>{Ve(),r!=null&&r.onClose?r.onClose():ct()});const dn=async a=>{if(!(n!=null&&n.prepare))return!1;try{const i=await n.prepare({model:Se(a)});return i.ready?!0:(console.error(`[pronunciation-coach] ensureLoaded(${a}) failed: code=${i.code??"—"} msg=${i.message??""}`),!1)}catch(i){return console.error(`[pronunciation-coach] ensureLoaded(${a}) threw:`,i),!1}},Pt=async()=>{if(ce)return;ce=!0,Ve(),$("idle");const a=_,i=q?_:null;console.log(`[pronunciation-coach] openModelSetup: modelMode=${_} modelReady=${q} activeForOverlay=${i??"null"}`);let l;try{l=await Fr({currentActive:i,headline:"Parlometron · Models",sub:"These are large, experimental, cutting-edge AI speech models running entirely on your device — no servers, no internet, no privacy compromises. They are also, frankly, not as reliable as you might hope. The bigger ones might crash your phone. The smaller ones might transcribe 'good morning' as 'goldfish moon'. Any of them might surprise you in either direction. Welcome to on-device AI in 2026. Don't take the scoring too seriously. 🤷"})}finally{ce=!1,xe()}if(s)return;if(l.kind==="exit"){!q&&a&&await dn(a)&&(q=!0);return}if(l.kind==="cancelled"){$("idle"),!q&&a&&await dn(a)&&(q=!0);return}if(l.mode===a&&q){$("idle");return}const h=l.mode;q=!1,W.disabled=!0;const y=ne(h);if(n!=null&&n.unload&&a&&a!==h){v.textContent=`Unloading ${ne(a)}…`,K(`Unloading ${ne(a)} model to free memory…`);try{await n.unload()}catch(k){console.warn("[pronunciation-coach] explicit unload before switch failed:",k)}}v.textContent=`Loading ${y} model…`,K(`Loading ${y} model…
This can take 10–30s on first launch.`);try{const k=await Rt(h);q=!0,_=h,ke(),xe(),console.log(`[pronunciation-coach] WhisperKit prepared: ${k.model} (${y})`),U(),W.disabled=!1,$("idle")}catch(k){const B=me(k),R=$t(k);if(console.error(`[pronunciation-coach] post-setup load failed (code=${R??"—"}):`,B),a&&a!==h)try{const D=await Rt(a);q=!0,_=a,xe(),U(),W.disabled=!1,$("idle"),H(R==="MODEL_NOT_INSTALLED"?`${y} isn't installed yet. Staying on ${ne(a)}.`:R==="NETWORK"?`${y} needs the tokenizer — check your connection. Staying on ${ne(a)}.`:`Couldn't switch to ${y}: ${B}. Staying on ${ne(a)}.`),console.log(`[pronunciation-coach] reverted to ${D.model} (${ne(a)}) after switch failure`);return}catch(D){console.error("[pronunciation-coach] revert to previous model also failed:",D)}U(),H(R==="MODEL_NOT_INSTALLED"?`${y} model isn't fully installed (likely a partial download). Tap the model badge to reinstall.`:R==="NETWORK"?`${y} model needs the tokenizer — check your connection and try again.`:`Could not load ${y} model: ${B}`),v.textContent="Model unavailable"}};x.addEventListener("click",()=>{Pt().catch(a=>{console.error("[pronunciation-coach] openModelSetup threw:",a)})});let ut=!1,At=0,pn=0,un=0,mt=0,Ot=0,Xe=!1,Nt=!1,Qe=null,ft=!1;const Or=()=>{if(T)try{const a=t.speak(T.targetLang,T.target.text);a&&typeof a.catch=="function"&&a.catch(i=>{console.error("[pronunciation-coach] speak phrase failed:",i)})}catch(a){console.error("[pronunciation-coach] speak phrase threw:",a)}},Nr=a=>!a||!(a instanceof Element)?!1:!!a.closest("button, input, textarea, select, a, [data-no-swipe]"),ze=J;ze.addEventListener("pointerdown",a=>{te!=="scoring"&&(Nr(a.target)||a.pointerType==="mouse"&&a.button!==0||(ut=!0,At=a.clientX,pn=a.clientY,mt=a.clientX,Ot=a.clientY,un=performance.now(),Xe=!1,Nt=!1,Qe=null,S.classList.add("dragging")))},{passive:!0}),ze.addEventListener("pointermove",a=>{if(!ut)return;mt=a.clientX,Ot=a.clientY;const i=mt-At,l=Ot-pn;if(!Xe&&!Nt)if(Math.abs(i)>12&&Math.abs(i)>Math.abs(l)*1.2){Xe=!0;try{ze.setPointerCapture(a.pointerId),Qe=a.pointerId}catch{}}else Math.abs(l)>12&&(Nt=!0);if(Xe){const h=i*.9;S.style.transition="none",S.style.transform=`translateX(${h}px) rotate(${h*.01}deg)`,S.style.opacity=String(Math.max(.4,1-Math.abs(i)/400))}},{passive:!0});const mn=()=>{if(!ut)return;if(ut=!1,S.classList.remove("dragging"),Qe!==null){try{ze.releasePointerCapture(Qe)}catch{}Qe=null}if(!Xe){S.style.transition="transform 200ms ease, opacity 200ms ease",S.style.transform="",S.style.opacity="";return}const a=mt-At,i=Math.max(1,performance.now()-un),l=Math.abs(a)/i,h=Math.abs(a)>=Dn,y=l>=Bn;h||y?(ft=!0,window.setTimeout(()=>{ft=!1},500),a<0?sn().catch(k=>console.error("[pronunciation-coach] swipe-next failed:",k)):X>0?cn().catch(k=>console.error("[pronunciation-coach] swipe-prev failed:",k)):(S.style.transition="transform 220ms ease, opacity 220ms ease",S.style.transform="",S.style.opacity="")):(S.style.transition="transform 220ms ease, opacity 220ms ease",S.style.transform="",S.style.opacity="")};ze.addEventListener("pointerup",mn,{passive:!0}),ze.addEventListener("pointercancel",mn,{passive:!0}),Z.addEventListener("click",a=>{if(ft){ft=!1;return}const i=a.target;i&&(i.closest("button, input, a")||i.closest(".pc-target, .pc-romanization")&&Or())});const fn=a=>{a.key==="ArrowLeft"?cn().catch(i=>console.error("[pronunciation-coach] arrow-left failed:",i)):a.key==="ArrowRight"?sn().catch(i=>console.error("[pronunciation-coach] arrow-right failed:",i)):a.key==="Escape"?ct():(a.key===" "||a.code==="Space")&&(a.preventDefault(),te==="idle"&&q&&T?ln().catch(i=>console.error("[pronunciation-coach] space-start failed:",i)):te==="recording"&&It().catch(i=>console.error("[pronunciation-coach] space-stop failed:",i)))};window.addEventListener("keydown",fn);const zr=700,Hr=8;let Je=null,He=null,Ze=null;const De=()=>{Je!==null&&(window.clearTimeout(Je),Je=null),He=null,Ze=null},hn=a=>{var h,y;const i=(y=(h=a.target)==null?void 0:h.closest)==null?void 0:y.call(h,"[data-pc-lang-badge]");if(!i)return;const l=i.getAttribute("data-pc-lang")||"";l&&(He={x:a.clientX,y:a.clientY},Ze=l,Je=window.setTimeout(()=>{Je=null,Ze&&!s&&En(Ze),Ze=null,He=null},zr))},gn=a=>{if(!He)return;const i=a.clientX-He.x,l=a.clientY-He.y;Math.hypot(i,l)>Hr&&De()};e.addEventListener("pointerdown",hn),e.addEventListener("pointermove",gn),e.addEventListener("pointerup",De),e.addEventListener("pointercancel",De);const Dr=()=>{const a=Zt(de);if(!a||!a.phrases||a.phrases.length===0)return!1;se=Math.max(0,Math.floor(a.streak)),V.length=0;for(const l of a.phrases)V.push(Gn(l));const i=Math.max(0,Math.min(V.length-1,a.idx));return X=i,T=V[i],T&&pt(),Ye(),!0},Br=async()=>{const a=t.getStackConfig();if(!a.languages||a.languages.length<2){T=null,Me(S,"Set up at least one target language","Open Corpán settings and add a target language to start practising."),W.disabled=!0,v.textContent="—";return}if(Dr()){console.log(`[pronunciation-coach] restored ${V.length} phrase(s) from storage; idx=${X}, streak=${se}`),qt();return}try{const i=await Ct();if(s)return;if(!i){H("No phrases available — check your stack config.");return}V.push(i),X=0,T=i,pt(),ke(),qt()}catch(i){console.error("[pronunciation-coach] loadFirstPhrase failed:",i),T=null,H(`Could not load a phrase: ${me(i)}`),W.disabled=!0,v.textContent="—"}},Fr=a=>new Promise(i=>{let{currentActive:l}=a;const h=document.createElement("div");h.className="pc-setup-root",h.innerHTML=`
        <div class="pc-backdrop"></div>
        <div class="pc-setup">
          <div class="pc-setup-header">
            <div class="pc-subtitle">Speech Models</div>
            <button class="pc-close" id="pc-setup-close" type="button" aria-label="Close">×</button>
          </div>
          <div class="pc-setup-body">
            <h1 class="pc-setup-headline">${Y(a.headline)}</h1>
            <p class="pc-setup-sub">${Y(a.sub)}</p>

            ${wt().map(m=>{const E=m.approxSizeMB>=1e3?`~${(m.approxSizeMB/1e3).toFixed(1)} GB`:`~${m.approxSizeMB} MB`;return`
            <div class="pc-setup-card" data-mode="${m.id}">
              <div class="pc-setup-card-head">
                <div>
                  <div class="pc-setup-card-name">${Y(m.label)} <span class="pc-setup-card-status" data-status="${m.id}"></span></div>
                  <div class="pc-setup-card-meta">${E}</div>
                </div>
                <div class="pc-setup-card-actions" data-actions="${m.id}"></div>
              </div>
              <div class="pc-setup-card-desc">${Y(m.shortDesc)}</div>
              <div class="pc-setup-card-procon">
                <ul class="pc-setup-card-pros">
                  ${m.pros.map(j=>`<li>${Y(j)}</li>`).join("")}
                </ul>
                <ul class="pc-setup-card-cons">
                  ${m.cons.map(j=>`<li>${Y(j)}</li>`).join("")}
                </ul>
              </div>
              <div class="pc-setup-card-techid" title="Underlying model file (whisper.cpp ggml format)">${Y(m.folder)}</div>
              <div class="pc-setup-progress" data-progress="${m.id}" hidden>
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
      `,e.appendChild(h);const y=h.querySelector("#pc-setup-error"),k=Object.fromEntries(wt().map(m=>[m.id,m.id===l?!0:null]));let B=null;const R=(m,E)=>{const j=h.querySelector(`[data-progress="${m}"]`);j&&(j.hidden=!E)},D=(m,E,j)=>{const I=h.querySelector(`[data-progress="${m}"]`);if(!I)return;const ae=I.querySelector(".pc-setup-progress-fill");ae&&(ae.style.width=`${Math.round(Math.max(0,Math.min(1,E))*100)}%`);const re=I.querySelector(".pc-setup-progress-label");re&&(re.textContent=j)},be=()=>{h.parentNode&&h.parentNode.removeChild(h)},M=()=>{for(const m of Te){const E=m.id,j=h.querySelector(`[data-status="${E}"]`),I=h.querySelector(`[data-actions="${E}"]`);if(!j||!I)continue;const ae=l===E,re=B===E,ve=ae?!0:k[E],qe=ve===null&&!ae&&!re;if(j.textContent=re?"Installing…":ae?"Active":qe?"Checking…":ve?"Installed":"Not installed",j.dataset.state=re?"installing":ae?"active":qe?"checking":ve?"installed":"absent",I.innerHTML="",re||qe)continue;const Re=(vt,yt,zt)=>{const Ie=document.createElement("button");Ie.type="button",Ie.className=`pc-setup-btn pc-setup-btn-${yt}`,Ie.textContent=vt,Ie.addEventListener("click",zt),I.appendChild(Ie)};ve?ae||(Re("Use this","primary",()=>{console.log(`[pronunciation-coach] CLICK Use-this mode=${E}`),ge(E)}),Re("Reinstall","ghost",()=>{console.log(`[pronunciation-coach] CLICK Reinstall mode=${E}`),gt(E,!0)}),Re("Remove","danger",()=>{console.log(`[pronunciation-coach] CLICK Remove mode=${E}`),ht(E)})):Re("Install","primary",()=>{console.log(`[pronunciation-coach] CLICK Install mode=${E}`),gt(E)})}},he=async()=>{if(n!=null&&n.validateModel){for(const m of Te){if(l===m.id){k[m.id]=!0;continue}try{const E=await n.validateModel({model:m.folder});k[m.id]=E.valid}catch(E){console.error(`[pronunciation-coach] validate ${m.id} failed:`,E),k[m.id]=!1}}M()}},ge=m=>{be(),i({kind:"selected",mode:m})},ht=async m=>{if(B||!(n!=null&&n.wipeModel))return;console.log(`[pronunciation-coach] removeModel: mode=${m} folder=${Se(m)} currentActive=${l??"null"} installed[${m}]=${k[m]}`);const E=k[m];B=m,M(),y.hidden=!0;try{await n.wipeModel({model:Se(m)}),k[m]=!1,l===m&&(l=null)}catch(j){k[m]=E;const I=me(j);y.textContent=`Remove failed: ${I}`,y.hidden=!1}finally{B=null,M()}},gt=async(m,E=!1)=>{var j;if(!(B||s||!(n!=null&&n.installModel))){if(B=m,y.hidden=!0,y.textContent="",M(),R(m,!0),E&&(n!=null&&n.wipeModel)){D(m,0,"Wiping previous install…");try{await n.wipeModel({model:Se(m)})}catch(I){console.warn("[pronunciation-coach] pre-reinstall wipe failed (continuing):",I)}}D(m,0,"Starting…");try{if(await n.installModel({model:Se(m),downloadUrl:(j=ye(m))==null?void 0:j.downloadUrl},I=>{if(I.model===Se(m))if(I.phase==="downloading"){let re=`Downloading ${Math.round((I.fraction??0)*100)}%`;if(I.completed!=null&&I.total&&I.total>0){const ve=qe=>(qe/1048576).toFixed(0);re+=` · ${ve(I.completed)} / ${ve(I.total)} MB`}D(m,I.fraction??0,re)}else I.phase==="verifying"?D(m,1,"Verifying files…"):I.phase==="verified"?D(m,1,"Verified ✓"):I.phase==="failed"&&D(m,0,`Failed: ${I.error??"unknown"}`)}),s)return;k[m]=!0,B=null,D(m,1,"Verified ✓"),setTimeout(()=>{be(),i({kind:"selected",mode:m})},300)}catch(I){B=null,R(m,!1);const ae=me(I);if(console.error(`[pronunciation-coach] install ${m} failed:`,ae),y.textContent=`Install failed: ${ae}`,y.hidden=!1,l&&l!==m&&(n!=null&&n.prepare))try{(await n.prepare({model:Se(l)})).ready&&console.log(`[pronunciation-coach] restored ${l} kit after ${m} install failed`)}catch(re){console.error(`[pronunciation-coach] kit restore after ${m} install failure threw:`,re)}M()}}},et=h.querySelector("#pc-setup-close");if(et==null||et.addEventListener("click",()=>{B||(be(),l&&k[l]?i({kind:"cancelled"}):(ct(),i({kind:"exit"})))}),l){const m=h.querySelector(`[data-mode="${l}"]`);m==null||m.classList.add("pc-setup-card-suggested")}M(),he().catch(m=>{console.error("[pronunciation-coach] refreshInstallState threw:",m)})});return(async()=>{var be;K("Checking models…");let a;try{a=await n.isAvailable()}catch(M){if(console.error("[pronunciation-coach] stt.isAvailable bridge call threw:",M),s)return;U(),P("Speech recognition bridge failed",`The native speech-recognition plugin returned an error: ${String(M)}`);return}if(s)return;if(!a){U(),P();return}try{const M=await n.getStatus();wn(M.availableMemoryMB??null),console.log(`[pronunciation-coach] device memory budget: available=${M.availableMemoryMB??"?"}MB physical=${M.physicalMemoryMB??"?"}MB raw=${JSON.stringify(M)}`)}catch(M){console.warn("[pronunciation-coach] getStatus failed; using conservative budget (Large variants hidden):",M)}const i=Zt(de);i!=null&&i.mode&&ye(i.mode)&&(_=i.mode);const l=ye(_);if(l&&$n(l)){const M=Ln().id;console.warn(`[pronunciation-coach] saved model "${_}" exceeds this device's memory budget; demoting to "${M}"`),_=M}xe();const h=ne(_),y=(((be=ye(_))==null?void 0:be.approxSizeMB)??0)>=300;K(y?`Loading ${h} model… first load can take ~1 minute for large models. Subsequent launches are faster.`:`Loading ${h} model…`),v.textContent=y?`Loading ${h} model… (first time can take ~1 minute)`:`Loading ${h} model…`;const k=_;let B=null,R;try{await Promise.all([Rt(k).then(M=>{q=!0,console.log(`[pronunciation-coach] WhisperKit prepared: ${M.model} (${ne(k)})`)}),Br()])}catch(M){B=M,R=$t(M),console.error(`[pronunciation-coach] boot prepare failed (code=${R??"—"}):`,me(M));const he=me(M);!R&&/<model dir missing>|Run install first/i.test(he)&&console.warn("%c[pronunciation-coach] STALE PLUGIN DETECTED","background:#9333ea;color:#fff;padding:2px 6px;border-radius:4px;font-weight:600","\nThe iOS app is running an old tauri-plugin-stt binary (no `code` field on errors, no marker file).",`
ValidateModel false-negatives in that build trigger destructive wipes on every Install click.`,`
Fix: rebuild and resideload the iOS app (cargo tauri ios dev) to pick up the marker-file fix.`)}if(s)return;if(q&&!B){U(),$("idle");return}U();const D=ne(k);if(R==="NETWORK"){H(`${D} model needs the tokenizer — check your connection. Your model files are intact.`),W.disabled=!0,v.textContent="Network needed";return}if(R&&R!=="MODEL_NOT_INSTALLED"&&R!=="LOAD_FAILED"){H(`Model failed to load: ${me(B)}`),W.disabled=!0,v.textContent="Model unavailable";return}R==="LOAD_FAILED"&&H(`${D} model failed to load. Use Reinstall in setup if it keeps happening.`),W.disabled=!0,v.textContent=`Loading ${D} model…`,Pt().catch(M=>{console.error("[pronunciation-coach] openModelSetup after boot prepare failure threw:",M)})})().catch(a=>{console.error("[pronunciation-coach] boot threw:",a)}),{unmount:()=>{s=!0,Ve(),window.removeEventListener("keydown",fn),e.removeEventListener("pointerdown",hn),e.removeEventListener("pointermove",gn),e.removeEventListener("pointerup",De),e.removeEventListener("pointercancel",De),De(),U(),w(),e.innerHTML=""}}},xt=3,tn="pc:parlometron:game-state",nr=()=>{try{return crypto.randomUUID()}catch{return`p_${Math.random().toString(36).slice(2,10)}_${Date.now()}`}},Mt=e=>({id:nr(),name:e}),rr=(e,t)=>{if(e.length<2)throw new Error("Parlometron needs at least 2 players");return{players:e.map(r=>({...r})),winTarget:t,currentRound:0,currentRoundOrder:[],currentPlayerIdx:0,attemptsLeft:{},bestThisRound:{},expectedTextThisRound:"",roundsWon:Object.fromEntries(e.map(r=>[r.id,0])),history:[]}},ar=e=>{const t=e.slice();for(let r=t.length-1;r>0;r--){const n=Math.floor(Math.random()*(r+1));[t[r],t[n]]=[t[n],t[r]]}return t},or=(e,t)=>(e.currentRound+=1,e.currentRoundOrder=ar(e.players.map(r=>r.id)),e.currentPlayerIdx=0,e.attemptsLeft=Object.fromEntries(e.players.map(r=>[r.id,xt])),e.bestThisRound=Object.fromEntries(e.players.map(r=>[r.id,null])),e.expectedTextThisRound=t,e),sr=(e,t,r)=>{const n=e.currentRoundOrder[e.currentPlayerIdx];if(!n||(e.attemptsLeft[n]??0)<=0)return e;const s=e.bestThisRound[n],o=Math.max(0,Math.min(100,Math.round(t)));return(!s||o>s.bestPercent)&&(e.bestThisRound[n]={playerId:n,bestPercent:o,heardText:r}),e.attemptsLeft[n]=Math.max(0,(e.attemptsLeft[n]??0)-1),e},ir=e=>{const t=e.currentRoundOrder[e.currentPlayerIdx];return t&&(e.attemptsLeft[t]=0),e.currentPlayerIdx+=1,e},cr=e=>e.currentPlayerIdx>=e.currentRoundOrder.length,lr=e=>e.players.some(t=>(e.roundsWon[t.id]??0)>=e.winTarget),dr=e=>{let t=-1;for(const r of e.players){const n=e.roundsWon[r.id]??0;n>t&&(t=n)}return t<1?[]:e.players.filter(r=>(e.roundsWon[r.id]??0)===t)},pr=e=>{var o;const t=e.players.map(c=>e.bestThisRound[c.id]??{playerId:c.id,bestPercent:0,heardText:""}).sort((c,p)=>p.bestPercent-c.bestPercent),r=((o=t[0])==null?void 0:o.bestPercent)??0,n=r>0?t.filter(c=>c.bestPercent===r).map(c=>c.playerId):[];for(const c of n)e.roundsWon[c]=(e.roundsWon[c]??0)+1;const s={round:e.currentRound,expectedText:e.expectedTextThisRound,results:t,winnerIds:n};return e.history.push(s),{state:e,round:s}},Tt=e=>{const t=e.currentRoundOrder[e.currentPlayerIdx];return t?e.players.find(r=>r.id===t)??null:null},lt=e=>{try{localStorage.setItem(tn,JSON.stringify(e))}catch(t){console.error("[parlometron/state] save failed:",t)}},Ue=()=>{try{localStorage.removeItem(tn)}catch(e){console.error("[parlometron/state] clear failed:",e)}},dt=2,je=8,nn=e=>e.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/'/g,"&#39;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),ur=e=>{var w,P;const t=((w=e.initial)==null?void 0:w.players.map(d=>({...d})))??[Mt("Player 1"),Mt("Player 2")];let r=((P=e.initial)==null?void 0:P.winTarget)??5;const n=()=>{const d=[3,5,7].map(b=>`
        <button type="button"
                class="pc-pm-target ${r===b?"active":""}"
                data-pm-target="${b}">
          ${b}
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
          <h3 class="pc-pm-section-title">Players (${t.length} / ${je})</h3>
          <ul class="pc-pm-roster" id="pc-pm-roster">${s()}</ul>
          <button class="pc-pm-add" data-pm-add
                  ${t.length>=je?"disabled":""}>
            + Add Player
          </button>
        </section>

        <section class="pc-pm-section">
          <h3 class="pc-pm-section-title">First to win</h3>
          <div class="pc-pm-target-row">
            ${d}
            <span class="pc-pm-target-suffix">rounds</span>
          </div>
        </section>

        <footer class="pc-pm-foot">
          <button class="pc-pm-start" id="pc-pm-start" disabled>
            Start game
          </button>
        </footer>
      </div>
    `,g(),o()},s=()=>t.map((d,b)=>`
        <li class="pc-pm-roster-row" data-pm-row="${d.id}">
          <span class="pc-pm-roster-num">${b+1}</span>
          <input type="text"
                 class="pc-pm-roster-name"
                 data-pm-name="${d.id}"
                 value="${nn(d.name)}"
                 maxlength="24"
                 placeholder="Player name"
                 autocapitalize="words"
                 autocorrect="off"
                 spellcheck="false" />
          <button class="pc-pm-roster-remove"
                  data-pm-remove="${d.id}"
                  aria-label="Remove ${nn(d.name)}"
                  ${t.length<=dt?"disabled":""}>×</button>
        </li>`).join(""),o=()=>{const d=e.container.querySelector("#pc-pm-start");if(!d)return;const b=t.every(u=>u.name.trim().length>0);d.disabled=!b||t.length<dt},c=()=>{const d=e.container.querySelector("[data-pm-add]");d&&(d.disabled=t.length>=je)},p=()=>{const d=e.container.querySelector("#pc-pm-roster");d&&(d.innerHTML=s());const b=e.container.querySelector(".pc-pm-section-title");b&&(b.textContent=`Players (${t.length} / ${je})`),f(),c(),o()},f=()=>{e.container.querySelectorAll("[data-pm-name]").forEach(d=>{const b=d.getAttribute("data-pm-name")||"";d.addEventListener("input",()=>{const u=t.find(x=>x.id===b);u&&(u.name=d.value),o()})}),e.container.querySelectorAll("[data-pm-remove]").forEach(d=>{d.addEventListener("click",()=>{if(t.length<=dt)return;const b=d.getAttribute("data-pm-remove")||"",u=t.findIndex(x=>x.id===b);u>=0&&(t.splice(u,1),p())})})},g=()=>{var d,b,u;(d=e.container.querySelector("[data-pm-back]"))==null||d.addEventListener("click",()=>e.onBack()),(b=e.container.querySelector("[data-pm-add]"))==null||b.addEventListener("click",()=>{t.length>=je||(t.push(Mt(`Player ${t.length+1}`)),p())}),e.container.querySelectorAll("[data-pm-target]").forEach(x=>{x.addEventListener("click",()=>{const J=Number(x.getAttribute("data-pm-target"));(J===3||J===5||J===7)&&(r=J,e.container.querySelectorAll("[data-pm-target]").forEach(Z=>{Z.classList.toggle("active",Number(Z.getAttribute("data-pm-target"))===J)}))})}),(u=e.container.querySelector("#pc-pm-start"))==null||u.addEventListener("click",()=>{const x=t.map(Z=>({...Z,name:Z.name.trim()})).filter(Z=>Z.name.length>0);if(x.length<dt)return;const J=rr(x,r);e.onStart(J)}),f()};return n(),{unmount:()=>{e.container.innerHTML=""}}},Et=e=>e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),rn=e=>new Promise(t=>{var o,c,p;const r=document.createElement("div");r.className="pc-pm-confirm-root",r.innerHTML=`
      <div class="pc-pm-confirm-backdrop" data-pm-confirm-backdrop></div>
      <div class="pc-pm-confirm-sheet" role="alertdialog" aria-modal="true">
        <p class="pc-pm-confirm-msg">${Et(e.message)}</p>
        <div class="pc-pm-confirm-foot">
          <button class="pc-pm-confirm-cancel" data-pm-confirm-cancel>
            ${Et(e.cancelLabel??"Cancel")}
          </button>
          <button class="pc-pm-confirm-go ${e.destructive?"danger":""}"
                  data-pm-confirm-go>
            ${Et(e.confirmLabel??"Confirm")}
          </button>
        </div>
      </div>`,document.body.appendChild(r),requestAnimationFrame(()=>r.classList.add("open"));const n=f=>{r.classList.remove("open"),window.setTimeout(()=>{r.parentNode&&r.parentNode.removeChild(r)},200),window.removeEventListener("keydown",s),t(f)},s=f=>{f.key==="Escape"?n(!1):f.key==="Enter"&&n(!0)};window.addEventListener("keydown",s),(o=r.querySelector("[data-pm-confirm-backdrop]"))==null||o.addEventListener("click",()=>n(!1)),(c=r.querySelector("[data-pm-confirm-cancel]"))==null||c.addEventListener("click",()=>n(!1)),(p=r.querySelector("[data-pm-confirm-go]"))==null||p.addEventListener("click",()=>n(!0))}),mr=9e4,fr=()=>`pm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`,Ge=e=>e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),hr=e=>Ge(e).replace(/"/g,"&quot;").replace(/'/g,"&#39;"),gr=e=>e?e.split("-")[0].toLowerCase():"en",vr=async(e,t,r)=>{let n=null;const s=new Promise((o,c)=>{n=setTimeout(()=>{c(new Error(`${r} timed out after ${Math.round(t/1e3)}s`))},t)});try{return await Promise.race([e,s])}finally{n&&clearTimeout(n)}},yr=(e,t)=>{const r=t.length>0?e.translations.find(o=>o.language_code===t[0])??null:null,n=[];for(const o of t.slice(1)){const c=e.translations.find(p=>p.language_code===o);c&&n.push(c)}return{target:n.length>0?n[Math.floor(Math.random()*n.length)]:null,native:r}},br=e=>{var $e;const t=e.hostApi.stt;if(!t)return e.container.innerHTML=`
      <div class="pc-pm-root pc-pm-error">
        <p>Whisper STT is not available on this device.</p>
        <button class="pc-pm-start" data-pm-quit>Back</button>
      </div>`,($e=e.container.querySelector("[data-pm-quit]"))==null||$e.addEventListener("click",e.onQuit),{unmount:()=>e.container.innerHTML=""};let r=!1,n="loading",s=null,o=null,c=null,p=null,f=null,g=null;const w=()=>{g&&(g.stop(),g=null)},P=()=>{var L,C,z,ee;e.container.innerHTML=`
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
      </div>`,(L=e.container.querySelector("[data-pm-quit]"))==null||L.addEventListener("click",async()=>{await rn({message:"Quit this game? Scores will be lost.",confirmLabel:"Quit",cancelLabel:"Keep playing",destructive:!0})&&(w(),s&&(t.cancelSession({sessionId:s}).catch(A=>console.error("[parlometron/round] cancel failed:",A)),s=null),e.onQuit())}),(C=e.container.querySelector("[data-pm-mic]"))==null||C.addEventListener("click",u),(z=e.container.querySelector("[data-pm-pass]"))==null||z.addEventListener("click",S),(ee=e.container.querySelector("[data-pm-splash-go]"))==null||ee.addEventListener("click",()=>{n="ready",d()});const v=e.container.querySelector("[data-pm-target]");v&&v.addEventListener("click",()=>{const O=o==null?void 0:o.text,A=o==null?void 0:o.language_code;if(!(!O||!A))try{const K=e.hostApi.speak(A,O);K&&typeof K.catch=="function"&&K.catch(U=>console.error("[parlometron/round] phrase speak failed:",U))}catch(K){console.error("[parlometron/round] phrase speak threw:",K)}})},d=()=>{if(r)return;const v=Tt(e.game),L=v?e.game.attemptsLeft[v.id]??0:0,C=xt-L,z=v?e.game.currentRoundOrder.indexOf(v.id)+1:e.game.currentRoundOrder.length,ee=e.game.currentRoundOrder.length,O=_=>e.container.querySelector(_),A=O("[data-pm-eyebrow]");if(A){const _=o!=null&&o.language_code?o.language_code.split("-")[0].toUpperCase():"",ce=_?` · ${_}`:"";A.textContent=`Round ${e.game.currentRound}${ce} · First to ${e.game.winTarget}`}const K=O("[data-pm-headline]");K&&(K.textContent=`${(v==null?void 0:v.name)??"—"}'s turn`);const U=O("[data-pm-turn]");U&&(U.textContent=`${z} / ${ee}`);const H=O("[data-pm-target]");H&&(H.textContent=(o==null?void 0:o.text)??"Loading…");const oe=O("[data-pm-roman]");if(oe){const ce=!!e.hostApi.getStackConfig().showRomanization,de=((o==null?void 0:o.romanization)??"").trim();ce&&de?(oe.textContent=de,oe.hidden=!1):oe.hidden=!0}const te=O("[data-pm-native]");if(te){const _=((c==null?void 0:c.text)??"").trim();_?(te.textContent=_,te.hidden=!1):te.hidden=!0}b();const q=O("[data-pm-mic]"),T=O("[data-pm-mic-label]"),V=O("[data-pm-tries]");q&&(q.classList.remove("recording","scoring"),q.disabled=n==="scoring"||n==="loading",n==="recording"?q.classList.add("recording"):n==="scoring"&&q.classList.add("scoring")),T&&(T.textContent=n==="loading"?"Loading…":n==="passing"?`${(v==null?void 0:v.name)??"—"}, get ready`:n==="recording"?"Tap to stop":n==="scoring"?"Scoring…":n==="result"&&L>0?"Tap to try again":n==="result"?"Tap mic or pass":"Tap to speak"),V&&(V.innerHTML=Array.from({length:xt},(_,ce)=>`<span class="pc-pm-try-dot ${ce<C?"used":""}"></span>`).join(""));const X=O("[data-pm-pass]");X&&X.classList.toggle("is-invisible",n!=="result");const fe=O("[data-pm-splash]"),se=O("[data-pm-splash-name]");fe&&(fe.hidden=n!=="passing"),se&&(se.textContent=(v==null?void 0:v.name)??"next player")},b=()=>{var Ye;const v=e.container.querySelector("[data-pm-banner]"),L=e.container.querySelector("[data-pm-transcript]"),C=e.container.querySelector("[data-pm-detail]");if(!v||!L||!C)return;if(f&&!p){v.className="pc-result-banner bad",v.innerHTML=`<span class="pc-result-banner-text">${Ge(f)}</span>`,v.hidden=!1,L.hidden=!0,C.hidden=!0,L.innerHTML="",C.innerHTML="";return}if(!p||n!=="result"){v.hidden=!0,L.hidden=!0,C.hidden=!0,v.innerHTML="",L.innerHTML="",C.innerHTML="";return}const z=p,ee=Math.max(0,Math.min(1,z.overallScore)),O=Math.round(ee*100),A=ee>=.85?"good":ee>=.6?"okay":"bad",K=A==="good"?"Nailed it":A==="okay"?"Close — try again":"";v.className=`pc-result-banner ${A}`,v.innerHTML=K?`
      <span class="pc-result-banner-score">${O}%</span>
      <span class="pc-result-banner-sep">·</span>
      <span class="pc-result-banner-text">${Ge(K)}</span>`:`<span class="pc-result-banner-score">${O}%</span>`,v.hidden=!1;const U=(z.freeText||z.text||"").trim();U?(L.innerHTML=`
        <div class="pc-transcripts">
          <div class="pc-transcript-row heard" role="button" tabindex="0"
               data-pm-speak-heard
               aria-label="Play what Whisper heard">
            <span class="pc-transcript-label">Heard you say</span>
            <span class="pc-transcript-line">
              <span class="pc-transcript-play" aria-hidden="true">▶</span>
              <span class="pc-transcript-text">${Ge(U)}</span>
            </span>
          </div>
        </div>`,L.hidden=!1,(Ye=L.querySelector("[data-pm-speak-heard]"))==null||Ye.addEventListener("click",()=>{const $=o==null?void 0:o.language_code;if($)try{const F=e.hostApi.speak($,U);F&&typeof F.catch=="function"&&F.catch(Q=>console.error("[parlometron/round] heard speak failed:",Q))}catch(F){console.error("[parlometron/round] heard speak threw:",F)}})):(L.innerHTML="",L.hidden=!0);const H=((o==null?void 0:o.text)??"").trim(),oe=(o==null?void 0:o.language_code)??z.language??"",te=Qt(z.words??[]),q=st(H),T=st(U),V=q.length>0&&q.length===te.length,X=q.length>0&&q.length===T.length,fe=U.length&&H.length?it(Le(U,oe),Le(H,oe)):null,se=q.length?q.map(($,F)=>({word:$,heardProb:V?te[F].probability:null,freeSim:X?it(Le($,oe),Le(T[F],oe)):fe})):H?[{word:H,heardProb:null,freeSim:fe}]:[],_=$=>$===null?null:$>=.9?"good":$>=.6?"okay":"bad",ce=$=>$===null?null:$>=.85?"good":$>=.6?"okay":"bad",de={bad:0,okay:1,good:2},ke=$=>{const F=_($.heardProb),Q=ce($.freeSim);return F===null&&Q===null?"":F===null?Q:Q===null||de[F]<=de[Q]?F:Q},xe=se.map(($,F)=>`<button class="pc-word ${ke($)}" type="button"
                   data-pm-word-idx="${F}"
                   aria-label="Speak ${hr($.word)}">${Ge($.word)}</button>`).join("");C.innerHTML=xe?`<div class="pc-words">${xe}</div>`:"",C.hidden=!xe,C.querySelectorAll("[data-pm-word-idx]").forEach($=>{$.addEventListener("click",()=>{var Ce;const F=Number($.getAttribute("data-pm-word-idx")),Q=(Ce=se[F])==null?void 0:Ce.word.trim(),Ke=o==null?void 0:o.language_code;if(!(!Q||!Ke))try{const Me=e.hostApi.speak(Ke,Q);Me&&typeof Me.catch=="function"&&Me.catch(pt=>console.error("[parlometron/round] word speak failed:",pt))}catch(Me){console.error("[parlometron/round] word speak threw:",Me)}})})},u=()=>{n==="ready"?J():n==="recording"?Z():n==="result"&&x()?(p=null,n="ready",d(),J()):n==="result"&&S()},x=()=>{const v=Tt(e.game);return v?(e.game.attemptsLeft[v.id]??0)>0:!1},J=async()=>{if(r||!Tt(e.game))return;const L=fr();s=L,p=null,f=null,n="recording",d();try{const C=gr((o==null?void 0:o.language_code)??"en"),z=await t.startSession({sessionId:L,language:C,expectedText:(o==null?void 0:o.text)??"",whisperParams:Ut(C)});if(r)return;if(!z.started)throw new Error("STT did not start");const ee=t.subscribeAudioLevel;if(ee){w();const O=L;g=Yt(A=>ee(A),jt(C),()=>{r||s===O&&(console.log("[parlometron/round] silence → stopRecording"),Z())})}}catch(C){console.error("[parlometron/round] startSession failed:",C),s=null,n="ready",d()}},Z=async()=>{if(r)return;w();const v=s;if(v){s=null,n="scoring",d();try{const L=await vr(t.stopSession({sessionId:v}),mr,"Scoring");if(r)return;const C=Math.round(Math.max(0,Math.min(1,L.overallScore))*100),z=L.text||L.freeText||"";sr(e.game,C,z),lt(e.game),p=L,n="result",d()}catch(L){const C=(L==null?void 0:L.message)??String(L),z=L==null?void 0:L.code;if(console.error(`[parlometron/round] stopSession failed (code=${z??"—"}):`,C),r)return;f=z==="NOT_PREPARED"||/not prepared/i.test(C)?"Speech model isn't loaded yet. Open Practice once to install it.":`Couldn't score this attempt: ${C}`,p=null,n="ready",d()}}},S=()=>{if(!r){if(ir(e.game),lt(e.game),cr(e.game)){const{round:v}=pr(e.game);lt(e.game),e.onRoundDone(v);return}p=null,n="passing",d()}};return(async()=>{var v,L,C;P(),n="loading",d();try{const z=e.hostApi.getStackConfig();if(!z.languages||z.languages.length<2){e.container.innerHTML=`
          <div class="pc-pm-root pc-pm-error">
            <p>Add a target language to your Corpán stack before starting Parlometron.</p>
            <button class="pc-pm-start" data-pm-quit>Back</button>
          </div>`,(v=e.container.querySelector("[data-pm-quit]"))==null||v.addEventListener("click",e.onQuit);return}const ee=e.hostApi.getRandomEntry;if(!ee)throw new Error("hostApi.getRandomEntry unavailable");const O=await ee();if(r)return;const{target:A,native:K}=yr(O,z.languages);if(!A){e.container.innerHTML=`
          <div class="pc-pm-root pc-pm-error">
            <p>This phrase doesn't have a translation in your target language.</p>
            <button class="pc-pm-start" data-pm-quit>Back</button>
          </div>`,(L=e.container.querySelector("[data-pm-quit]"))==null||L.addEventListener("click",e.onQuit);return}o=A,c=K,or(e.game,A.text),lt(e.game),n="passing",d()}catch(z){if(console.error("[parlometron/round] boot failed:",z),r)return;e.container.innerHTML=`
        <div class="pc-pm-root pc-pm-error">
          <p>Couldn't load a phrase. Try again later.</p>
          <button class="pc-pm-start" data-pm-quit>Back</button>
        </div>`,(C=e.container.querySelector("[data-pm-quit]"))==null||C.addEventListener("click",e.onQuit)}})(),{unmount:()=>{r=!0,w(),s&&(t.cancelSession({sessionId:s}).catch(v=>console.error("[parlometron/round] unmount cancel:",v)),s=null),e.container.innerHTML=""}}},_e=e=>e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),an=(e,t)=>e.players.find(r=>r.id===t),wr=e=>{const{game:t,round:r}=e,n=r.winnerIds.map(p=>{var f;return((f=an(t,p))==null?void 0:f.name)??"—"}).filter(Boolean),s=n.length===0?"No round winner.":n.length===1?`${n[0]} wins the round`:`${n.join(" & ")} tie for the round`,o=r.results.map(p=>{const f=an(t,p.playerId),g=r.winnerIds.includes(p.playerId),w=t.roundsWon[p.playerId]??0;return`
        <tr class="${g?"winner":""}">
          <td class="pc-pm-score-name">${_e((f==null?void 0:f.name)??"—")}</td>
          <td class="pc-pm-score-pct">${p.bestPercent}%</td>
          <td class="pc-pm-score-heard">${_e((p.heardText||"—").slice(0,60))}</td>
          <td class="pc-pm-score-total">${w}</td>
        </tr>`}).join("");return e.container.innerHTML=`
    <div class="pc-pm-root pc-pm-results">
      <header class="pc-pm-head">
        <div class="pc-pm-head-eyebrow-row">
          <span class="pc-pm-eyebrow">Round ${r.round} · First to ${t.winTarget}</span>
        </div>
        <div class="pc-pm-head-action-row">
          <button class="pc-pm-back" data-pm-quit aria-label="Quit game">‹</button>
          <span class="pc-pm-headline">${_e(s)}</span>
          <div class="pc-pm-head-spacer"></div>
        </div>
      </header>

      <main class="pc-pm-results-body">
        <p class="pc-pm-results-phrase">
          <span class="pc-pm-results-phrase-label">Phrase</span>
          <span class="pc-pm-results-phrase-text">${_e(r.expectedText)}</span>
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
    </div>`,(()=>{var f,g,w;const p=async()=>{await rn({message:"Quit this game?",confirmLabel:"Quit",cancelLabel:"Keep playing",destructive:!0})&&e.onQuit()};(f=e.container.querySelector("[data-pm-quit]"))==null||f.addEventListener("click",p),(g=e.container.querySelector("[data-pm-quit2]"))==null||g.addEventListener("click",p),(w=e.container.querySelector("[data-pm-next]"))==null||w.addEventListener("click",()=>e.onNextRound())})(),{unmount:()=>{e.container.innerHTML=""}}},Sr=e=>{var c,p;const{game:t}=e,r=dr(t),n=r.length===0?"Game over":r.length===1?`${r[0].name} wins!`:`${r.map(f=>f.name).join(" & ")} tie!`,o=[...t.players].sort((f,g)=>(t.roundsWon[g.id]??0)-(t.roundsWon[f.id]??0)).map((f,g)=>{const w=t.roundsWon[f.id]??0,P=r.some(u=>u.id===f.id),d=t.history.map(u=>u.results.find(x=>x.playerId===f.id)).filter(u=>!!u),b=d.length?Math.round(d.reduce((u,x)=>u+x.bestPercent,0)/d.length):0;return`
        <tr class="${P?"winner":""}">
          <td class="pc-pm-score-rank">${g+1}</td>
          <td class="pc-pm-score-name">${_e(f.name)}</td>
          <td class="pc-pm-score-total">${w}</td>
          <td class="pc-pm-score-pct">${b}%</td>
        </tr>`}).join("");return e.container.innerHTML=`
    <div class="pc-pm-root pc-pm-gameover">
      <header class="pc-pm-head pc-pm-gameover-head">
        <div class="pc-pm-head-eyebrow-row">
          <span class="pc-pm-eyebrow">${_e(`Best of ${t.winTarget*2-1}-ish · ${t.history.length} rounds played`)}</span>
        </div>
        <div class="pc-pm-head-action-row">
          <span class="pc-pm-headline pc-pm-winner">${_e(n)}</span>
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
    </div>`,(c=e.container.querySelector("[data-pm-done]"))==null||c.addEventListener("click",()=>e.onDone()),(p=e.container.querySelector("[data-pm-again]"))==null||p.addEventListener("click",()=>e.onPlayAgain()),{unmount:()=>{e.container.innerHTML=""}}},Lr="pc:parlometron:last-mode",$r="corpan-pronunciation-coach:v2",kr=()=>{let e=null;try{const t=localStorage.getItem($r);if(t){const r=JSON.parse(t),n=ye(r.mode);n&&(e=n.folder)}}catch(t){console.warn("[parlometron] reading saved model failed:",t)}return e??Ft().folder},xr=e=>{const t=e.stt;if(!(t!=null&&t.prepare))return;const r=kr();console.log("[parlometron] ensureModelPrepared — calling prepare:",r),t.prepare({model:r}).then(n=>{n.ready?console.log(`[parlometron] model ready: ${n.model??r}`):console.warn(`[parlometron] prepare reported not ready (code=${n.code??"—"}): ${n.message??""}`)}).catch(n=>{console.warn("[parlometron] prepare threw:",n)})},Mr=(e,t)=>{let r=null,n=null,s=null;const o=()=>{if(r){try{r.unmount()}catch(d){console.error("[parlometron] unmount threw:",d)}r=null}},c=()=>{var d;o(),n=null,e.innerHTML=`
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
      </div>`,(d=e.querySelector("[data-pm-picker-close]"))==null||d.addEventListener("click",()=>{try{window.dispatchEvent(new CustomEvent("corpan:exit"))}catch(b){console.error("[parlometron] dispatch exit failed:",b)}}),e.querySelectorAll("[data-pm-mode]").forEach(b=>b.addEventListener("click",()=>{const u=b.getAttribute("data-pm-mode");try{localStorage.setItem(Lr,u??"")}catch{}u==="practice"?p():u==="friends"&&(Ue(),f(s??void 0))})),r={unmount:()=>{e.innerHTML=""}}},p=()=>{o(),r=tr(e,t,{onClose:()=>c()})},f=d=>{o(),r=ur({container:e,onBack:()=>c(),onStart:u=>{n=u,s={players:u.players.map(x=>({...x})),winTarget:u.winTarget},g()},initial:d})},g=()=>{if(!n){c();return}o(),r=br({container:e,hostApi:t,game:n,onRoundDone:b=>{n&&(lr(n)?P():w(b))},onQuit:()=>{Ue(),n=null,c()}})},w=d=>{if(!n){c();return}o(),r=wr({container:e,game:n,round:d,onNextRound:()=>g(),onQuit:()=>{Ue(),n=null,c()}})},P=()=>{if(!n){c();return}o(),r=Sr({container:e,game:n,onPlayAgain:()=>{const b=s;Ue(),n=null,f(b??void 0)},onDone:()=>{Ue(),n=null,c()}})};return xr(t),c(),{unmount:()=>{var b;o(),e.innerHTML="";const d=t.stt;(b=d==null?void 0:d.releaseAudio)==null||b.call(d).catch(u=>{console.error("[parlometron] releaseAudio failed:",u)})}}},Tr="/__console",Er="8990";function _r(){var r,n;if(typeof document>"u")return null;const e=((n=(r=document.currentScript)==null?void 0:r.dataset)==null?void 0:n.corpGameBaseUrl)??null;if(!e)return null;let t;try{t=new URL(e)}catch{return null}return t.protocol!=="http:"?null:`${t.protocol}//${t.hostname}:${Er}${Tr}`}function Cr(e){if(e==null||typeof e=="string"||typeof e=="number"||typeof e=="boolean")return e;if(e instanceof Error)return{__error:!0,name:e.name,message:e.message,stack:e.stack};try{return JSON.stringify(e),e}catch{try{return String(e)}catch{return"[unserializable]"}}}let on=!1;function qr(){if(on)return;const e=_r();if(!e)return;on=!0;const t={log:console.log.bind(console),info:console.info.bind(console),warn:console.warn.bind(console),error:console.error.bind(console)},r=(s,o)=>{try{const c=JSON.stringify({level:s,args:o.map(Cr),ts:Date.now()});fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:c,keepalive:!0}).catch(()=>{})}catch{}},n=s=>(...o)=>{r(s,o),t[s](...o)};console.log=n("log"),console.info=n("info"),console.warn=n("warn"),console.error=n("error"),typeof window<"u"&&(window.addEventListener("error",s=>{r("error",["[unhandled error]",s.message,s.filename,`${s.lineno}:${s.colno}`])}),window.addEventListener("unhandledrejection",s=>{r("error",["[unhandled rejection]",String(s.reason)])})),t.log(`[devConsole] forwarding to ${e}`)}qr();const Rr="pronunciation_coach";(()=>{const e=globalThis,t=e.CorpanGames=e.CorpanGames||{};t[Rr]={mount:(r,n,s)=>{const o=globalThis;o.__pronunciationCoach&&(o.__pronunciationCoach.dispose(),o.__pronunciationCoach=void 0);const c=Mr(r,n),p={dispose:()=>{c.unmount()}};return o.__pronunciationCoach=p,{unmount:()=>{p.dispose(),o.__pronunciationCoach=void 0}}}}})()})();
