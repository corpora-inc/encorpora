globalThis.process=globalThis.process||{env:{}};(function(){"use strict";let lt=null,dt=null;const Mn=6500,xn=8e3,Tn=(e,t)=>{typeof e=="number"&&Number.isFinite(e)&&e>0&&(lt=e),typeof t=="number"&&Number.isFinite(t)&&t>0&&(dt=t)},Cn=()=>{if(typeof navigator>"u")return!1;const e=navigator.userAgent||"";return/iPad/.test(e)?!0:/iPhone|iPod/.test(e)?!1:!!(/Macintosh/.test(e)&&(navigator.maxTouchPoints??0)>1)},Yt=()=>lt!=null&&lt>=Mn||dt!=null&&dt>=xn?!0:lt==null&&dt==null?Cn():!1,qe=[{id:"tiny_proof",folder:"ggml-tiny.bin",label:"Tiny",shortDesc:"Tiny is, honestly, kind of terrible. You say 'good morning,' Tiny writes 'good warning.' Mostly useful as the baseline you compare bigger models against.",pros:["Tiniest download","Fast on every device","Works offline like everything here"],cons:["Frequently wrong on real sentences","Especially weak on non-Latin scripts"],approxSizeMB:75,defaultForFreshInstall:!0},{id:"small",folder:"ggml-small.bin",label:"Small",shortDesc:"First model that genuinely works for everyday Spanish, French, German, and friends. Boring, reasonable choice for Latin-script languages.",pros:["Solid for most European languages","Modest size and RAM use"],cons:["Less reliable than the Larges","Drifts on harder or longer sentences"],approxSizeMB:465,defaultForFreshInstall:!1},{id:"large_turbo",folder:"ggml-large-v3-turbo-q5_0.bin",label:"Large Turbo q5",shortDesc:"The smallest 'Large.' Whisper's speedy distilled decoder, weights crushed to 5 bits.",pros:["Smallest of the Large family","Snappy on iOS; the q8 variant is the equivalent pick on Android"],cons:["Slow on Android (5-bit math doesn't play well with Android CPUs — try the q8 Turbo instead)","Distilled decoder is weaker on Telugu / Tamil / other non-Latin scripts"],approxSizeMB:547,defaultForFreshInstall:!1},{id:"large_q8",folder:"ggml-large-v3-turbo-q8_0.bin",label:"Large Turbo q8",shortDesc:"Same Turbo distillation as q5, but at 8-bit precision — math most CPUs prefer. The Turbo sweet spot on Android.",pros:["~2.5× faster than q5 on Android","Better quality than q5","Works well on iOS too"],cons:["Bigger download than q5","Same Turbo weakness on non-Latin scripts"],approxSizeMB:834,defaultForFreshInstall:!1},{id:"large_qlora",folder:"ggml-large-v3-q5_0.bin",label:"Large q5",shortDesc:"Full Whisper Large brain — no Turbo distillation — compressed to 5 bits. Best in our testing for Telugu, Tamil, Bengali, and other non-Latin-script languages.",pros:["Best for Indic and other non-Latin-script languages","Keeps the full 32-layer text decoder","Honest output in the right script"],cons:["~1 GB download","Slower than Turbo on both platforms"],approxSizeMB:1031,defaultForFreshInstall:!1},{id:"medium",folder:"ggml-medium.bin",label:"Full Weight Medium",shortDesc:"Older Whisper architecture at full precision (no compression). Wins occasionally on languages later models quietly got worse at. Usually outdone by Large q5.",pros:["Every weight at native fp16 precision","Occasionally surprises on niche languages"],cons:["Bigger download than Large q5 for usually less quality","Older architecture"],approxSizeMB:1463,defaultForFreshInstall:!1},{id:"large_max",folder:"ggml-large-v3-turbo.bin",label:"Full Weight Large Turbo",shortDesc:"Whisper's speedy Turbo distillation at full 16-bit precision. Where the GPU fp16 fast path is available, it's quick despite the size.",pros:["Fastest 'Large' on iOS (Metal fp16 fast path)","Top quality for Latin-script languages"],cons:["1.5 GB download","CPU-only on Android, so slower there","Same Turbo weakness on Indic — Large q5 or q8 is better for those"],approxSizeMB:1549,defaultForFreshInstall:!1},{id:"large_q8_full",folder:"ggml-large-v3-q8_0.bin",label:"Large q8 ★",shortDesc:"The biggest, baddest model that still fits in app memory — full Whisper Large at 8-bit precision (we quantize this one ourselves from the original fp16, since upstream doesn't ship it). Should be the new best for Indic and other non-Latin-script languages.",pros:["Higher precision than Large q5, same full 32-layer decoder","Expected best quality for Telugu, Tamil, Bengali, etc."],cons:["~1.6 GB download","Slower than Turbo and a bit slower than Large q5","Needs ~3 GB RAM headroom during first transcribe"],approxSizeMB:1580,defaultForFreshInstall:!1,requiresLargeMemory:!0,downloadUrl:"https://d38iwc9748jekz.cloudfront.net/whisper-models/ggml-large-v3-q8_0.bin"}],Ct=()=>Yt()?qe:qe.filter(e=>!e.requiresLargeMemory),_n=()=>{const e=Ct();return e.find(t=>t.defaultForFreshInstall)??e[0]},Rn=e=>!!e.requiresLargeMemory&&!Yt(),me=e=>{if(e)return qe.find(t=>t.id===e)},Kt=()=>qe.find(e=>e.defaultForFreshInstall)??qe[0],Ne={temperature:0,temperature_inc:.2,entropy_thold:2.4,logprob_thold:-1,no_speech_thold:.6,suppress_blank:!0,suppress_nst:!1,n_threads:0,initial_prompt:""},pt={te:{temperature_inc:0,initial_prompt:"నేను తెలుగు నేర్చుకుంటున్నాను. నేను ఒక పదబంధం ప్రయత్నిస్తాను, మీరు విన్నది నిజాయితీగా చెప్పండి."},ta:{temperature_inc:0,initial_prompt:"நான் தமிழ் கற்றுக்கொள்கிறேன். ஒரு சொற்றொடரை முயற்சிக்கப் போகிறேன், நீங்கள் கேட்டதை நேர்மையாகச் சொல்லுங்கள்."},ml:{temperature_inc:0,initial_prompt:"ഞാൻ മലയാളം പഠിക്കുകയാണ്. ഞാൻ ഒരു വാക്യം പറയാൻ പോകുന്നു, നിങ്ങൾ കേട്ടത് സത്യസന്ധമായി പറയൂ."},bn:{temperature_inc:0,initial_prompt:"আমি বাংলা শিখছি। আমি একটি বাক্যাংশ চেষ্টা করব, আপনি যা শুনেছেন তা সততার সাথে বলুন।"},mr:{temperature_inc:0,initial_prompt:"मी मराठी शिकत आहे. मी एक वाक्यांश प्रयत्न करणार आहे, तुम्ही ऐकलेले प्रामाणिकपणे सांगा."},gu:{temperature_inc:0,initial_prompt:"હું ગુજરાતી શીખું છું. હું એક વાક્ય બોલવાનો છું, તમે જે સાંભળ્યું તે પ્રામાણિકતાથી કહો."},pa:{temperature_inc:0,initial_prompt:"ਮੈਂ ਪੰਜਾਬੀ ਸਿੱਖ ਰਿਹਾ ਹਾਂ। ਮੈਂ ਇੱਕ ਵਾਕੰਸ਼ ਅਜ਼ਮਾਉਣ ਜਾ ਰਿਹਾ ਹਾਂ, ਤੁਸੀਂ ਜੋ ਸੁਣਿਆ ਉਹ ਇਮਾਨਦਾਰੀ ਨਾਲ ਦੱਸੋ।"},or:{temperature_inc:0,initial_prompt:"ମୁଁ ଓଡ଼ିଆ ଶିଖୁଛି। ମୁଁ ଗୋଟିଏ ଶବ୍ଦଗୁଚ୍ଛ ଚେଷ୍ଟା କରିବି, ଆପଣ ଯାହା ଶୁଣିଲେ ସତ୍ୟ ଭାବରେ କୁହନ୍ତୁ।"},as:{temperature_inc:0,initial_prompt:"মই অসমীয়া শিকি আছোঁ। মই এটা বাক্যাংশ চেষ্টা কৰিম, আপুনি যি শুনিলে সেইটো সত্যনিষ্ঠভাৱে কওক।"},ne:{temperature_inc:0,initial_prompt:"म नेपाली सिक्दैछु। म एउटा वाक्यांश प्रयास गर्ने छु, तपाईंले सुनेको कुरा इमानदारीपूर्वक भन्नुहोस्।"},si:{temperature_inc:0,initial_prompt:"මම සිංහල ඉගෙන ගන්නවා. මම වාක්‍ය ඛණ්ඩයක් උත්සාහ කරන්නම්, ඔබ ඇසූදේ අවංකව කියන්න."},fa:{temperature_inc:0,initial_prompt:"من فارسی یاد می‌گیرم. می‌خواهم یک عبارت بگویم، آنچه شنیدید را صادقانه بگویید."},ur:{temperature_inc:0,initial_prompt:"میں اردو سیکھ رہا ہوں۔ میں ایک جملہ بولنے جا رہا ہوں، جو آپ نے سنا اسے دیانتداری سے بتائیں۔"}},Vt="pc:whisper-tuning",Ie=()=>{try{const e=localStorage.getItem(Vt);if(!e)return{};const t=JSON.parse(e);return!t||typeof t!="object"?{}:t}catch(e){return console.error("[whisperTuning] loadUserOverrides failed:",e),{}}},_t=e=>{try{localStorage.setItem(Vt,JSON.stringify(e))}catch(t){console.error("[whisperTuning] saveUserOverrides failed:",t)}},Rt=(e,t)=>{const r=Ie(),n=e.split("-")[0].toLowerCase(),o={...r[n]??{},...t};for(const c of Object.keys(o))o[c]===void 0&&delete o[c];Object.keys(o).length===0?delete r[n]:r[n]=o,_t(r)},qn=e=>{const t=Ie(),r=e.split("-")[0].toLowerCase();delete t[r],_t(t)},In=()=>{_t({})},Xt=e=>{const t=e.split("-")[0].toLowerCase(),r=pt[t]??{},n=Ie()[t]??{};return{...r,...n}},ut=[{key:"temperature_inc",label:"temperature_inc",min:0,max:.5,step:.05,help:"Step for the fallback ladder (0.0 → 0.2 → 0.4 → … → 1.0). 0.0 disables retries entirely — one greedy decode, deterministic."},{key:"temperature",label:"temperature",min:0,max:1.5,step:.05,help:"Initial decoding temperature. 0.0 = greedy. Raise to sample from the start (almost never want for transcription)."},{key:"entropy_thold",label:"entropy_thold",min:0,max:10,step:.1,help:"Compression-ratio-style quality gate. Higher = more permissive. Indic BPE routinely exceeds 2.4 default."},{key:"logprob_thold",label:"logprob_thold",min:-5,max:0,step:.1,help:"Avg per-token log-prob below which the decode is flagged unconfident and the fallback fires."},{key:"no_speech_thold",label:"no_speech_thold",min:0,max:1,step:.05,help:"Whisper's posterior threshold for 'this segment is silence.' Above this, the segment emits nothing."},{key:"n_threads",label:"n_threads",min:0,max:12,step:1,help:"CPU thread count. 0 = let the plugin decide (cores − 2). Higher uses more battery; lower can free the UI thread."}],mt=[{key:"suppress_blank",label:"suppress_blank",help:"Suppress blank tokens at the start of a segment."},{key:"suppress_nst",label:"suppress_nst",help:"Suppress non-speech tokens (music, noise markers). False by default."}],ft=[{key:"initial_prompt",label:"initial_prompt",placeholder:"(empty)",help:"Up to ~224 tokens prepended before decoding. Bias toward a script/language; do NOT leak the expected phrase (model will parrot it). Native-script primer recommended for Indic langs."}],An=e=>e.split("-")[0].toLowerCase(),ke=(e,t)=>t>=1?String(Math.round(e)):t>=.1?e.toFixed(1):e.toFixed(2),Ye=e=>e.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;");let le=null,fe="";const Pn=e=>{var s,o,c,u,f;le&&Ke(),fe=An(e);const t=document.createElement("div");t.className="pc-tuner-root",t.innerHTML=On(fe),document.body.appendChild(t),requestAnimationFrame(()=>{t.classList.add("open")}),(s=t.querySelector("[data-pc-tuner-backdrop]"))==null||s.addEventListener("click",Ke),(o=t.querySelector("[data-pc-tuner-close]"))==null||o.addEventListener("click",Ke);const r=t.querySelector("[data-pc-tuner-handle]"),n=t.querySelector(".pc-tuner-sheet");if(r&&n){let v=0,w=0,D=!1;const m=6;r.addEventListener("pointerdown",S=>{D=!0,v=S.clientY,w=Date.now(),r.setPointerCapture(S.pointerId),n.style.transition="none"}),r.addEventListener("pointermove",S=>{if(!D)return;const F=Math.max(0,S.clientY-v);n.style.transform=`translateY(${F}px)`});const y=(S,F)=>{if(!D)return;D=!1;try{r.releasePointerCapture(S.pointerId)}catch{}const b=S.clientY-v,R=Date.now()-w,xe=R>0?b/R:0,h=n.offsetHeight*.15,$=F&&(b>h||xe>.5&&b>20||Math.abs(b)<m);n.style.transition="",n.style.transform="",$&&Ke()};r.addEventListener("pointerup",S=>y(S,!0)),r.addEventListener("pointercancel",S=>y(S,!1))}t.addEventListener("keydown",v=>{v.key==="Escape"&&Ke()});for(const v of ut)zn(t,v);for(const v of mt)Dn(t,v);for(const v of ft)Fn(t,v);(c=t.querySelector("[data-pc-tuner-copy]"))==null||c.addEventListener("click",Un),(u=t.querySelector("[data-pc-tuner-reset-lang]"))==null||u.addEventListener("click",Wn),(f=t.querySelector("[data-pc-tuner-reset-all]"))==null||f.addEventListener("click",jn),le=t},Ke=()=>{if(!le)return;const e=le;le=null,e.classList.remove("open"),window.setTimeout(()=>{e.parentNode&&e.parentNode.removeChild(e)},240)},On=e=>{const t=pt[e]??{},r=Ie()[e]??{},n=ut.map(c=>Nn(c,t,r)).join(""),s=mt.map(c=>Bn(c,t,r)).join(""),o=ft.map(c=>Hn(c,t,r)).join("");return`
    <div class="pc-tuner-backdrop" data-pc-tuner-backdrop></div>
    <div class="pc-tuner-sheet" role="dialog" aria-label="Whisper tuning">
      <div class="pc-tuner-handle" data-pc-tuner-handle
           role="button" aria-label="Close tuner" tabindex="0">
        <div class="pc-tuner-handle-bar"></div>
      </div>
      <header class="pc-tuner-head">
        <div class="pc-tuner-title">
          <span class="pc-tuner-eyebrow">whisper tuning</span>
          <span class="pc-tuner-lang">${Ye(e.toUpperCase())}</span>
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
  `},Nn=(e,t,r)=>{const n=Ne[e.key]??0,s=t[e.key],o=r[e.key],c=o!==void 0?o:s!==void 0?s:n,u=o!==void 0&&o!==n,f=[];return f.push(`<span>default <b>${ke(n,e.step)}</b></span>`),s!==void 0&&f.push(`<span>built-in <b>${ke(s,e.step)}</b></span>`),u&&f.push('<span class="pc-tuner-modified">modified</span>'),`
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
               value="${ke(c,e.step)}"
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
  `},Bn=(e,t,r)=>{const n=Ne[e.key],s=t[e.key],o=r[e.key],c=o!==void 0?o:s!==void 0?s:n,u=o!==void 0&&o!==n;return`
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
        ${u?`<span class="pc-tuner-sep">·</span>
               <span class="pc-tuner-modified">modified</span>`:""}
      </div>
      <p class="pc-tuner-help">${e.help}</p>
    </div>
  `},Hn=(e,t,r)=>{const n=t[e.key],s=r[e.key],o=s!==void 0?s:n!==void 0?n:"",c=s!==void 0&&s!==(n??""),u=[];return n&&n.length>0?u.push(`<span>built-in <b>"${Ye(n)}"</b></span>`):u.push("<span>default <b>(empty)</b></span>"),c&&u.push('<span class="pc-tuner-modified">modified</span>'),`
    <div class="pc-tuner-row pc-tuner-row-text" data-pc-row="${e.key}">
      <div class="pc-tuner-row-head">
        <label class="pc-tuner-row-label" for="pc-tuner-text-${e.key}">
          ${e.label}
        </label>
      </div>
      <textarea id="pc-tuner-text-${e.key}"
                class="pc-tuner-text"
                rows="2"
                placeholder="${Ye(e.placeholder)}"
                data-pc-tuner-text="${e.key}"
                spellcheck="false"
                autocapitalize="off"
                autocorrect="off">${Ye(o)}</textarea>
      <div class="pc-tuner-row-trail">
        ${u.join('<span class="pc-tuner-sep">·</span>')}
      </div>
      <p class="pc-tuner-help">${e.help}</p>
    </div>
  `},zn=(e,t)=>{const r=e.querySelector(`[data-pc-tuner-slider="${t.key}"]`),n=e.querySelector(`[data-pc-tuner-num="${t.key}"]`);if(!r||!n)return;const s=o=>{const c=parseFloat(o);if(Number.isNaN(c))return;const u=Math.min(t.max,Math.max(t.min,c));Rt(fe,{[t.key]:u}),r.value=String(u),n.value=ke(u,t.step),Be(e,t.key)};r.addEventListener("input",()=>{n.value=ke(parseFloat(r.value),t.step)}),r.addEventListener("change",()=>s(r.value)),n.addEventListener("change",()=>s(n.value))},Dn=(e,t)=>{const r=e.querySelector(`[data-pc-tuner-bool="${t.key}"]`);r&&r.addEventListener("change",()=>{Rt(fe,{[t.key]:r.checked}),Be(e,t.key)})},Fn=(e,t)=>{const r=e.querySelector(`[data-pc-tuner-text="${t.key}"]`);if(!r)return;const n=()=>{const s=r.value;Rt(fe,{[t.key]:s.length>0?s:void 0}),Be(e,t.key)};r.addEventListener("blur",n),r.addEventListener("keydown",s=>{s.key==="Enter"&&!(s.metaKey||s.ctrlKey||s.shiftKey)&&(s.preventDefault(),r.blur())})},Be=(e,t)=>{const r=pt[fe]??{},n=Ie()[fe]??{},s=e.querySelector(`[data-pc-row="${t}"]`);if(!s)return;const o=s.querySelector(".pc-tuner-row-trail");if(!o)return;const c=ut.find(v=>v.key===t);if(c){const v=Ne[t]??0,w=r[t],D=n[t],m=D!==void 0&&D!==v,y=[`<span>default <b>${ke(v,c.step)}</b></span>`];w!==void 0&&y.push(`<span>built-in <b>${ke(w,c.step)}</b></span>`),m&&y.push('<span class="pc-tuner-modified">modified</span>'),o.innerHTML=y.join('<span class="pc-tuner-sep">·</span>');return}if(mt.find(v=>v.key===t)){const v=Ne[t],w=r[t],D=n[t],m=D!==void 0&&D!==v,y=[`<span>default <b>${v?"on":"off"}</b></span>`];w!==void 0&&y.push(`<span>built-in <b>${w?"on":"off"}</b></span>`),m&&y.push('<span class="pc-tuner-modified">modified</span>'),o.innerHTML=y.join('<span class="pc-tuner-sep">·</span>');return}if(ft.find(v=>v.key===t)){const v=r[t],w=n[t],D=w!==void 0&&w!==(v??""),m=[];v&&v.length>0?m.push(`<span>built-in <b>"${Ye(v)}"</b></span>`):m.push("<span>default <b>(empty)</b></span>"),D&&m.push('<span class="pc-tuner-modified">modified</span>'),o.innerHTML=m.join('<span class="pc-tuner-sep">·</span>')}},Un=async()=>{var t;const e=JSON.stringify(Ie(),null,2);try{await((t=navigator.clipboard)==null?void 0:t.writeText(e)),ht(`Copied (${e.length} chars)`)}catch(r){console.error("[whisperTunerUI] clipboard write failed:",r),ht("Copy failed — see console")}},Qt=e=>{const t=pt[fe]??{},r=Ie()[fe]??{};for(const n of ut){const s=Ne[n.key]??0,o=r[n.key]!==void 0?r[n.key]:t[n.key]!==void 0?t[n.key]:s,c=e.querySelector(`[data-pc-tuner-slider="${n.key}"]`),u=e.querySelector(`[data-pc-tuner-num="${n.key}"]`);c&&(c.value=String(o)),u&&(u.value=ke(o,n.step)),Be(e,n.key)}for(const n of mt){const s=Ne[n.key],o=r[n.key]!==void 0?r[n.key]:t[n.key]!==void 0?t[n.key]:s,c=e.querySelector(`[data-pc-tuner-bool="${n.key}"]`);c&&(c.checked=o),Be(e,n.key)}for(const n of ft){const s=r[n.key]!==void 0?r[n.key]:t[n.key]!==void 0?t[n.key]:"",o=e.querySelector(`[data-pc-tuner-text="${n.key}"]`);o&&(o.value=s),Be(e,n.key)}},Wn=()=>{le&&(qn(fe),Qt(le),ht("Reset to built-in"))},jn=()=>{le&&(In(),Qt(le),ht("All languages reset"))},ht=e=>{if(!le)return;const t=le.querySelector(".pc-tuner-foot");if(!t)return;const r=document.createElement("div");r.className="pc-tuner-flash",r.textContent=e,t.appendChild(r),window.setTimeout(()=>{r.parentNode&&r.parentNode.removeChild(r)},1600)};function Jt(){return typeof navigator>"u"?!0:navigator.onLine}function Gn(e){if(typeof window>"u")return()=>{};const t=()=>e(!0),r=()=>e(!1);return window.addEventListener("online",t),window.addEventListener("offline",r),()=>{window.removeEventListener("online",t),window.removeEventListener("offline",r)}}function Yn(){const e=document.createElementNS("http://www.w3.org/2000/svg","svg");e.setAttribute("viewBox","0 0 24 24"),e.setAttribute("class","corpan-offline-notice__icon"),e.setAttribute("aria-hidden","true");const t=document.createElementNS("http://www.w3.org/2000/svg","path");return t.setAttribute("d","M2 2l20 20M5.78 5.78A7 7 0 0 0 9 19h9.5a4.5 4.5 0 0 0 1.78-8.63 7 7 0 0 0-12.55-3.07"),t.setAttribute("stroke-linecap","round"),t.setAttribute("stroke-linejoin","round"),e.appendChild(t),e}function Kn(e){const t=e.density??"default",r=document.createElement("div");r.setAttribute("role","status"),r.setAttribute("aria-live","polite"),r.className=`corpan-offline-notice corpan-offline-notice--${t}`,r.appendChild(Yn());const n=document.createElement("p");if(n.className="corpan-offline-notice__title",n.textContent=e.title,r.appendChild(n),e.subtitle&&t!=="compact"){const s=document.createElement("p");s.className="corpan-offline-notice__subtitle",s.textContent=e.subtitle,r.appendChild(s)}if(e.action&&t!=="compact"){const s=document.createElement("div");s.className="corpan-offline-notice__action",s.appendChild(e.action),r.appendChild(s)}return{element:r,setTitle:s=>{n.textContent=s},remove:()=>{r.remove()}}}const gt=e=>{if(e&&typeof e=="object"){const t=e.code;if(typeof t=="string")return t}},he=e=>{if(e==null)return"(unknown error)";if(typeof e=="string")return e;if(e instanceof Error)return e.message||e.name||String(e);if(typeof e=="object"){const t=e,r=[t.message,t.localizedDescription,t.error,t.description,t.detail];for(const n of r)if(typeof n=="string"&&n.length>0)return n;try{const n=JSON.stringify(e);if(n&&n!=="{}")return n}catch{}}return String(e)},Vn=70,Xn=.4,qt="corpan-pronunciation-coach:v2",Zt="corpan-pronunciation-coach:v1",Qn=50,Ee=e=>{var t;return((t=me(e))==null?void 0:t.folder)??e},J=e=>{var t;return((t=me(e))==null?void 0:t.label)??e},Jn=e=>{const t=me(e);return t&&t.approxSizeMB>=1e3?18e4:6e4},Zn=9e4,en=async(e,t,r)=>{let n=null;const s=new Promise((o,c)=>{n=setTimeout(()=>{c(new Error(`${r} timed out after ${Math.round(t/1e3)}s`))},t)});try{return await Promise.race([e,s])}finally{n&&clearTimeout(n)}},er=e=>{var t,r,n;return{entryId:e.entry.entry_id,level:e.entry.level,domains:e.entry.domains??[],targetLang:e.targetLang,targetText:e.target.text,targetRoman:e.target.romanization??"",nativeLang:((t=e.native)==null?void 0:t.language_code)??null,nativeText:((r=e.native)==null?void 0:r.text)??"",nativeRoman:((n=e.native)==null?void 0:n.romanization)??""}},tr=e=>({entry:{entry_id:e.entryId,level:e.level,domains:e.domains,translations:[]},target:{language_code:e.targetLang,text:e.targetText,romanization:e.targetRoman},native:e.nativeLang?{language_code:e.nativeLang,text:e.nativeText,romanization:e.nativeRoman}:null,targetLang:e.targetLang}),tn=/[''']/,nr={en:{zero:"0",one:"1",two:"2",three:"3",four:"4",five:"5",six:"6",seven:"7",eight:"8",nine:"9",ten:"10",eleven:"11",twelve:"12",thirteen:"13",fourteen:"14",fifteen:"15",sixteen:"16",seventeen:"17",eighteen:"18",nineteen:"19",twenty:"20",thirty:"30",forty:"40",fifty:"50",sixty:"60",seventy:"70",eighty:"80",ninety:"90",hundred:"100",thousand:"1000"},es:{cero:"0",uno:"1",una:"1",dos:"2",tres:"3",cuatro:"4",cinco:"5",seis:"6",siete:"7",ocho:"8",nueve:"9",diez:"10",once:"11",doce:"12",trece:"13",catorce:"14",quince:"15",dieciséis:"16",dieciseis:"16",diecisiete:"17",dieciocho:"18",diecinueve:"19",veinte:"20",treinta:"30",cuarenta:"40",cincuenta:"50",sesenta:"60",setenta:"70",ochenta:"80",noventa:"90",cien:"100",ciento:"100",mil:"1000"},fr:{zéro:"0",zero:"0",un:"1",une:"1",deux:"2",trois:"3",quatre:"4",cinq:"5",six:"6",sept:"7",huit:"8",neuf:"9",dix:"10",onze:"11",douze:"12",treize:"13",quatorze:"14",quinze:"15",seize:"16",vingt:"20",trente:"30",quarante:"40",cinquante:"50",soixante:"60",cent:"100",mille:"1000"},it:{zero:"0",uno:"1",una:"1",due:"2",tre:"3",quattro:"4",cinque:"5",sei:"6",sette:"7",otto:"8",nove:"9",dieci:"10",undici:"11",dodici:"12",tredici:"13",quattordici:"14",quindici:"15",sedici:"16",diciassette:"17",diciotto:"18",diciannove:"19",venti:"20",trenta:"30",quaranta:"40",cinquanta:"50",sessanta:"60",settanta:"70",ottanta:"80",novanta:"90",cento:"100",mille:"1000"},de:{null:"0",eins:"1",ein:"1",eine:"1",zwei:"2",drei:"3",vier:"4",fünf:"5",funf:"5",sechs:"6",sieben:"7",acht:"8",neun:"9",zehn:"10",elf:"11",zwölf:"12",zwolf:"12",dreizehn:"13",vierzehn:"14",fünfzehn:"15",funfzehn:"15",sechzehn:"16",siebzehn:"17",achtzehn:"18",neunzehn:"19",zwanzig:"20",dreißig:"30",dreissig:"30",vierzig:"40",fünfzig:"50",funfzig:"50",sechzig:"60",siebzig:"70",achtzig:"80",neunzig:"90",hundert:"100",tausend:"1000"},pt:{zero:"0",um:"1",uma:"1",dois:"2",duas:"2",três:"3",tres:"3",quatro:"4",cinco:"5",seis:"6",sete:"7",oito:"8",nove:"9",dez:"10",onze:"11",doze:"12",treze:"13",catorze:"14",quatorze:"14",quinze:"15",dezesseis:"16",dezasseis:"16",dezessete:"17",dezassete:"17",dezoito:"18",dezenove:"19",dezanove:"19",vinte:"20",trinta:"30",quarenta:"40",cinquenta:"50",sessenta:"60",setenta:"70",oitenta:"80",noventa:"90",cem:"100",cento:"100",mil:"1000"}},rr=new Set(["te","ta","bn","ml","mr","gu","pa","ur","fa","si","ne","or","as"]),ar=new Set(["ar","he","fa","ur"]),or=new Set(["pa-arab"]),nn=e=>{if(!e)return!1;const t=e.toLowerCase();return or.has(t)?!0:ar.has(t.split("-")[0])},Me=(e,t)=>{const r=e.normalize("NFC").toLowerCase().replace(/[\p{P}\p{S}\p{C}]/gu,"").replace(/\s+/g," ").trim();if(!r)return r;const n=(t??"").toLowerCase().split("-")[0],s=nr[n];return s?r.split(" ").map(o=>s[o]??o).join(" "):r},sr=/[぀-ゟ゠-ヿ㐀-䶿一-鿿豈-﫿가-힯]/,yt=e=>{const t=e.trim();if(!t)return[];if(/\s/.test(t))return t.split(/\s+/).filter(Boolean);if(sr.test(t)){const r=Intl.Segmenter;if(typeof r=="function"){const n=new r(void 0,{granularity:"grapheme"});return Array.from(n.segment(t),s=>s.segment).filter(s=>s.trim().length>0)}return Array.from(t).filter(n=>n.trim().length>0)}return[t]},vt=(e,t)=>{const r=Array.from(e),n=Array.from(t),s=r.length,o=n.length;if(s===0&&o===0)return 1;if(s===0||o===0)return 0;let c=new Array(o+1),u=new Array(o+1);for(let f=0;f<=o;f++)c[f]=f;for(let f=1;f<=s;f++){u[0]=f;for(let w=1;w<=o;w++)u[w]=r[f-1]===n[w-1]?c[w-1]:1+Math.min(c[w],u[w-1],c[w-1]);const v=c;c=u,u=v}return 1-c[o]/Math.max(s,o)},rn=e=>{if(!e||e.length===0)return[];const t=[];for(const r of e){const n=t[t.length-1];if(n){const s=n.word.replace(/\s+$/,"").slice(-1),o=r.word.replace(/^\s+/,"").charAt(0),c=tn.test(s),u=tn.test(o);if(c||u){n.word=n.word+r.word.replace(/^\s+/,""),n.endMs=Math.max(n.endMs,r.endMs),n.probability=Math.min(n.probability,r.probability);continue}}t.push({...r})}return t},ir=()=>{try{const e=window.localStorage,t="__pc_probe__";return e.setItem(t,"1"),e.removeItem(t),e}catch{return null}},an=e=>{if(!e)return null;try{const t=JSON.parse(e);return typeof t!="object"||t===null||!Array.isArray(t.phrases)||typeof t.idx!="number"||typeof t.streak!="number"?null:t}catch(t){return console.error("[pronunciation-coach] localStorage parse failed:",t),null}},on=e=>{if(!e)return null;const t=an(e.getItem(qt));if(t)return t;const r=an(e.getItem(Zt));if(!r)return null;const n={...r,mode:r.mode==="standard"?"standard":void 0};try{e.setItem(qt,JSON.stringify(n)),e.removeItem(Zt),console.log("[pronunciation-coach] migrated v1 → v2 storage, mode preserved:",n.mode??"(cleared)")}catch(s){console.error("[pronunciation-coach] storage migration failed:",s)}return n},cr=()=>{try{const e=globalThis.crypto;if(e&&typeof e.randomUUID=="function")return e.randomUUID()}catch(e){console.error("[pronunciation-coach] randomUUID failed:",e)}return`pc-${Date.now()}-${Math.floor(Math.random()*1e9)}`},sn=e=>e?e.split("-")[0].toLowerCase():"en",lr=e=>{const t=[...e];for(let r=t.length-1;r>0;r--){const n=Math.floor(Math.random()*(r+1));[t[r],t[n]]=[t[n],t[r]]}return t},dr=(e,t)=>{const r=t.length>0?e.translations.find(o=>o.language_code===t[0])??null:null;let n=null;const s=lr(t.slice(1));for(const o of s){const c=e.translations.find(u=>u.language_code===o);if(c){n=c;break}}return n||(n=e.translations.find(o=>!r||o.language_code!==r.language_code)??null),{target:n,native:r}},Z=e=>e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"),bt=()=>{try{window.dispatchEvent(new CustomEvent("corpan:exit"))}catch(e){console.error("[pronunciation-coach] dispatch exit failed:",e)}},pr=e=>{const t=document.createElement("div");t.className="pc-confetti";const r=["#7c3aed","#16a34a","#facc15","#ec4899","#06b6d4"],n=32;for(let s=0;s<n;s++){const o=document.createElement("span");o.style.left=`${Math.random()*100}%`,o.style.background=r[s%r.length],o.style.animationDelay=`${Math.random()*200}ms`,o.style.animationDuration=`${900+Math.random()*600}ms`,o.style.transform=`rotate(${Math.random()*360}deg)`,t.appendChild(o)}e.appendChild(t),window.setTimeout(()=>t.remove(),1800)},ur=(e,t,r)=>{const n=t.stt;let s=!1,o=null;const c=document.querySelector('meta[name="viewport"]'),u=(c==null?void 0:c.getAttribute("content"))??null;c&&c.setAttribute("content","width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover");const f=()=>{c&&u!==null&&c.setAttribute("content",u)},v=(a="Speech recognition isn't available on this device",i="Parlometron needs the on-device Whisper plugin and didn't find a working one here. Try updating the app, or this platform may not be supported yet.")=>{var l;e.innerHTML=`
      <div class="pc-root">
        <div class="pc-header">
          <div class="pc-header-left"></div>
          <div class="pc-header-right">
            <button class="pc-close" id="pc-close" type="button" aria-label="Close">×</button>
          </div>
        </div>
        <div class="pc-unavailable">
          <h2>${Z(a)}</h2>
          <p>${Z(i)}</p>
        </div>
      </div>
    `,(l=e.querySelector("#pc-close"))==null||l.addEventListener("click",bt)};if(!n)return v(),{unmount:()=>{f(),e.innerHTML=""}};e.innerHTML=`
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
  `;const w=e.querySelector("#pc-close"),D=e.querySelector("#pc-streak"),m=e.querySelector("#pc-streak-n"),y=e.querySelector("#pc-mode"),S=e.querySelector("#pc-swipe-area"),F=e.querySelector("#pc-deck");let b=e.querySelector("#pc-card");const R=e.querySelector("#pc-mic"),xe=e.querySelector("#pc-mic-icon"),h=e.querySelector("#pc-mic-label"),$=a=>a.querySelector("[data-pc-result-banner]"),x=a=>a.querySelector("[data-pc-result-transcript-up]"),B=a=>a.querySelector("[data-pc-result-bars-up]"),ae=a=>a.querySelector("[data-pc-result-detail]"),z=e.querySelector("#pc-error");let P=null;const K=(a,i)=>{P||(P=document.createElement("div"),P.className="pc-overlay",P.innerHTML=`
        <div class="pc-spinner"></div>
        <div id="pc-overlay-msg"></div>
        <button id="pc-overlay-cancel" type="button" hidden></button>`,document.body.appendChild(P));const l=P.querySelector("#pc-overlay-msg");l&&(l.textContent=a);const d=P.querySelector("#pc-overlay-cancel");d&&(i!=null&&i.cancelLabel&&i.onCancel?(d.textContent=i.cancelLabel,d.hidden=!1,d.onclick=i.onCancel):(d.hidden=!0,d.onclick=null))},Y=()=>{P&&P.parentNode&&P.parentNode.removeChild(P),P=null},q=a=>{z.textContent=a,z.hidden=!1,console.error("[pronunciation-coach]",a)},ge=()=>{z.textContent="",z.hidden=!0};let ne="idle",I=!1,k=null;const V=[];let U=-1,ye=null,ce=0,M=Kt().id,oe=!1;const de=ir(),Te=()=>{if(de)try{const a=Math.max(0,V.length-Qn),i=V.slice(a).map(er),l=U-a,d={streak:ce,phrases:i,idx:l,mode:M};de.setItem(qt,JSON.stringify(d))}catch(a){console.error("[pronunciation-coach] persist failed:",a)}},He=()=>{const a=me(M);y.setAttribute("aria-pressed",M==="advanced"?"true":"false"),y.classList.toggle("advanced",M==="advanced"),y.disabled=oe;const i=a?`${a.label} model (~${a.approxSizeMB} MB) · tap to switch`:`${J(M)} model · tap to switch`;y.title=i,y.setAttribute("aria-label",`Speech model: ${J(M)}`);const l=e.querySelector("#pc-footer-model");l&&(l.textContent=J(M))},Je=()=>{ce<=0?D.hidden=!0:(m.textContent=String(ce),D.hidden=!1)},ee=a=>{ne=a,R.classList.remove("recording","scoring"),R.disabled=!1,a==="idle"?(xe.innerHTML="●",h.textContent=I?"Tap to speak":"Loading model…",R.disabled=!I||!k):a==="recording"?(R.classList.add("recording"),xe.innerHTML="■",h.textContent="Listening… tap to stop"):a==="scoring"&&(R.classList.add("scoring"),xe.innerHTML='<div class="pc-spinner"></div>',h.textContent="Scoring…",R.disabled=!0)},ze=(a,i,l)=>`
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
  `,be=e.querySelector("#pc-lang-badge"),Ze=a=>{if(!a){be.hidden=!0,be.textContent="—",be.setAttribute("data-pc-lang","");return}const i=sn(a);be.hidden=!1,be.textContent=i.toUpperCase(),be.setAttribute("data-pc-lang",i),be.setAttribute("aria-label",`Target language ${i.toUpperCase()} — long-press to tune Whisper`)},O=(a,i)=>{var E;const d=!!t.getStackConfig().showRomanization,g=i.target.romanization||"",T=d&&g?`<p class="pc-romanization">${Z(g)}</p>`:"",N=(E=i.native)!=null&&E.text?`<p class="pc-native">${Z(i.native.text)}</p>`:"";a.innerHTML=ze(`<h1 class="pc-target">${Z(i.target.text||"—")}</h1>`,T,N),Ze(i.targetLang)},G=(a,i,l)=>{a.innerHTML=ze(`<h1 class="pc-target">${Z(i)}</h1>`,"",`<p class="pc-native">${Z(l)}</p>`),Ze(null)},se=()=>{k&&O(b,k)},De=async(a,i)=>{const l=F.clientWidth||window.innerWidth,d=a==="left"?-1:1;b.style.transition="transform 220ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 200ms ease",b.style.transform=`translateX(${d*l}px)`,b.style.opacity="0",await new Promise(T=>window.setTimeout(T,220));const g=document.createElement("div");g.className="pc-card entering",g.id="pc-card",g.style.transition="none",g.style.transform=`translateX(${-d*l}px)`,g.style.opacity="0",i(g),F.replaceChild(g,b),b=g,b.offsetWidth,b.style.transition="transform 280ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 240ms ease",b.style.transform="translateX(0)",b.style.opacity="1",b.classList.remove("entering"),b.classList.add("entered")},Fe=async()=>{const a=t.getStackConfig();if(!a.languages||a.languages.length<2||!t.getRandomEntry)return null;const i=await t.getRandomEntry(),{target:l,native:d}=dr(i,a.languages);return l?{entry:i,target:l,native:d,targetLang:l.language_code}:null},we=()=>{ye||s||Fe().then(a=>{!s&&a&&(ye=a)}).catch(a=>{console.error("[pronunciation-coach] prefetch failed:",a)})},Lt=async()=>{if(ne==="scoring")return;et(),ge();const a=t.getStackConfig();if(!a.languages||a.languages.length<2){k=null,G(b,"Set up at least one target language","Open Corpán settings and add a target language to start practising."),R.disabled=!0,h.textContent="—";return}if(U>=0&&U<V.length-1){const l=V[U+1];U+=1,await De("left",d=>O(d,l)),k=l,ee("idle"),Te();return}let i=ye;if(ye=null,!i)try{i=await Fe()}catch(l){console.error("[pronunciation-coach] fetch next failed:",l),q(`Could not load a phrase: ${he(l)}`);return}if(!i){q("No phrases available — check your stack config.");return}V.push(i),U=V.length-1,await De("left",l=>O(l,i)),k=i,ee("idle"),Te(),we()},mn=async()=>{if(ne==="scoring"||U<=0)return;et(),ge();const a=V[U-1];U-=1,await De("right",i=>O(i,a)),k=a,ee("idle"),Te()},Wr=a=>{const i=$(a),l=x(a),d=B(a),g=ae(a),T=()=>{i&&(i.innerHTML="",i.hidden=!0,i.className="pc-result-banner"),l&&(l.innerHTML="",l.hidden=!0,l.className="pc-result-transcript-up"),d&&(d.innerHTML="",d.hidden=!0,d.className="pc-result-bars-up"),g&&(g.innerHTML="",g.hidden=!0,g.className="pc-result-detail")};if(!(i&&!i.hidden||l&&!l.hidden||d&&!d.hidden||g&&!g.hidden)){T();return}i&&!i.hidden&&i.classList.add("leaving"),l&&!l.hidden&&l.classList.add("leaving"),d&&!d.hidden&&d.classList.add("leaving"),g&&!g.hidden&&g.classList.add("leaving"),window.setTimeout(T,220)},jr=()=>Wr(b),Gr=a=>{const i=Math.max(0,Math.min(1,a.overallScore)),l=Math.max(0,Math.min(1,a.noSpeechProb??0)),d=a.compressionRatio??0,g=Math.max(0,Math.min(1,a.freeVsConstrainedSimilarity??1)),T=A=>`${Math.round(A*100)}%`,N=l>.5;let E="bad",H="Try again";N?(E="bad",H="🎙️ Couldn't hear you"):i>=.95?(E="good",H="✨ Perfect!"):i>=.85?(E="good",H="🎉 Nailed it!"):i>=.75?(E="good",H="Great"):i>=.6?(E="okay",H="Pretty good"):i>=.45?(E="okay",H="Close — keep going"):i>=.25&&(E="bad",H="Keep practicing"),N||(i>=.85?(ce+=1,pr(document.body)):i>=.6||(ce=0)),Je(),Te();const W=rn(a.words||[]),L=((k==null?void 0:k.target.text)||"").trim(),j=yt(L),pe=(a.freeText||"").trim(),ve=yt(pe),ot=j.length>0&&j.length===W.length,Se=j.length>0&&j.length===ve.length,st=L.length>0&&pe.length===0,Ce=(k==null?void 0:k.targetLang)||a.language||"",Mt=pe.length&&L.length?vt(Me(pe,Ce),Me(L,Ce)):st?0:null,it=j.length?j.map((A,Q)=>({word:A,heardProb:ot?W[Q].probability:null,freeSim:Se?vt(Me(A,Ce),Me(ve[Q],Ce)):Mt})):L?[{word:L,heardProb:null,freeSim:Mt}]:[],ct=A=>A===null?null:A>=.9?"good":A>=.6?"okay":"bad",p=A=>A===null?null:A>=.85?"good":A>=.6?"okay":"bad",C={bad:0,okay:1,good:2},X=A=>{const Q=ct(A.heardProb),ie=p(A.freeSim);return Q===null&&ie===null?"":Q===null?ie:ie===null||C[Q]<=C[ie]?Q:ie},_=it.map((A,Q)=>`<button class="pc-word ${X(A)}" type="button" data-pc-word-idx="${Q}" aria-label="Speak ${Z(A.word)}">${Z(A.word)}</button>`).join(""),te=nn(Ce),re=te?"pc-transcript-line pc-transcript-line-rtl":"pc-transcript-line",Le=te?"◀":"▶",_e=pe.length?`<div class="pc-transcript-row heard" role="button" tabindex="0"
             data-pc-speak="heard" data-no-swipe
             aria-label="Play what Whisper heard">
           <span class="pc-transcript-label">Heard you say</span>
           <span class="${re}">
             <span class="pc-transcript-play" aria-hidden="true">${Le}</span>
             <span class="pc-transcript-text">${Z(pe)}</span>
           </span>
         </div>`:st?`<div class="pc-transcript-row heard empty">
             <span class="pc-transcript-label">Heard you say</span>
             <span class="pc-transcript-line">
               <span class="pc-transcript-text empty">(couldn't make out the words)</span>
             </span>
           </div>`:"",Pe=_e?`<div class="pc-transcripts">${_e}</div>`:"",xt={"pa-arab":"Different writing system — scoring may be off","yue-hant-hk":"Different writing system — scoring may be off","zh-hans":"Different writing system — scoring may be off","zh-hant":"Different writing system — scoring may be off"},Ut=(a.language??"").toLowerCase(),Tt=xt[Ut],$e=[];l>.2&&$e.push('<div class="pc-chip pc-chip-warn">Sounded faint — try a bit louder</div>');const Wt=Ce.toLowerCase().split("-")[0],Re=rr.has(Wt)?3.5:2.4;d>Re&&$e.push('<div class="pc-chip pc-chip-warn">Sounded a bit garbled</div>'),st?$e.push(`<div class="pc-chip pc-chip-warn">Couldn't make out the words</div>`):g<.6&&$e.push(`<div class="pc-chip pc-chip-warn">Words didn't quite match</div>`),Tt&&$e.push(`<div class="pc-chip">${Z(Tt)}</div>`);const ta=$e.length?`<div class="pc-chips pc-diagnostics">${$e.join("")}</div>`:"",Oe=$(b),jt=x(b),Gt=B(b),Ge=ae(b);if(!Oe||!Ge){console.error("[pronunciation-coach] renderResult: card missing result slots");return}if(N)Oe.className=`pc-result-banner ${E}`,Oe.innerHTML=`
        <span class="pc-result-banner-score">—</span>
        <span class="pc-result-banner-sep">·</span>
        <span class="pc-result-banner-text">${H}</span>
      `,Oe.hidden=!1,Ge.innerHTML=`
        <div class="pc-chips">
          <div class="pc-chip">Move the device closer or speak louder.</div>
        </div>
      `,Ge.hidden=!1;else{Oe.className=`pc-result-banner ${E}`,Oe.innerHTML=`
        <span class="pc-result-banner-score">${T(i)}</span>
        <span class="pc-result-banner-sep">·</span>
        <span class="pc-result-banner-text">${H}</span>
      `,Oe.hidden=!1,jt&&(jt.innerHTML=Pe,jt.hidden=!Pe),Gt&&(Gt.innerHTML="",Gt.hidden=!0);const A=te?"pc-words pc-words-rtl":"pc-words";Ge.innerHTML=`
        ${_?`<div class="${A}">${_}</div>`:""}
        ${ta}
      `,Ge.hidden=!1}const En=(A,Q)=>{const ie=(k==null?void 0:k.targetLang)||a.language||"en";try{const ue=t.speak(ie,A);ue&&typeof ue.catch=="function"&&ue.catch(na=>{console.error(`[pronunciation-coach] ${Q} speak failed:`,na)})}catch(ue){console.error(`[pronunciation-coach] ${Q} speak threw:`,ue)}};Ge.querySelectorAll("button.pc-word[data-pc-word-idx]").forEach(A=>{A.addEventListener("click",()=>{const Q=A.getAttribute("data-pc-word-idx");if(Q===null)return;const ie=Number(Q),ue=it[ie];ue&&En(ue.word.trim(),"word")})}),b.querySelectorAll(".pc-transcript-row[data-pc-speak]").forEach(A=>{const Q=()=>{pe&&En(pe,"heard")};A.addEventListener("click",Q),A.addEventListener("keydown",ie=>{const ue=ie.key;(ue==="Enter"||ue===" ")&&(ie.preventDefault(),Q())})})},et=()=>{const a=o;o=null,a&&n.cancelSession({sessionId:a}).catch(i=>{console.error("[pronunciation-coach] cancelSession failed:",i)})},fn=async()=>{if(!k||!I)return;ge(),jr();const a=cr();o=a;try{ee("recording");const i=sn(k.targetLang),l=await n.startSession({sessionId:a,language:i,expectedText:k.target.text,whisperParams:Xt(i)});if(s)return;if(!l.started)throw new Error("STT plugin reported started=false")}catch(i){console.error("[pronunciation-coach] startSession failed:",i),o=null,q(`Could not start recording: ${he(i)}`),ee("idle")}},Nt=async a=>{if(!n)throw new Error("STT unavailable");const i=Ee(a),l=await en(n.prepare({model:i}),Jn(a),`Loading ${J(a)} model`);if(!l.ready){const d=new Error(l.message||"Model not ready");throw d.code=l.code,d}return l};class hn extends Error{constructor(){super("Switch cancelled by user"),this.name="SwitchCancelledError"}}const gn=1500,Bt=10,Yr=async a=>{const i=J(a);let l=null,d=!1;const g=()=>{d=!0};for(let T=1;T<=Bt;T++){if(d)throw new hn;try{return await Nt(a)}catch(N){if(gt(N)!=="INSUFFICIENT_MEMORY")throw N;if(l=N,T===Bt)break;const H=Bt-T;K(`Freeing memory for ${i}…
This usually takes a few seconds.`,{cancelLabel:"Cancel",onCancel:g}),console.log(`[pronunciation-coach] INSUFFICIENT_MEMORY on attempt ${T}; waiting ${gn}ms, ${H} retries left`),await new Promise(W=>setTimeout(W,gn))}}throw l??new Error("INSUFFICIENT_MEMORY")},yn=async()=>{const a=o;if(!a){ee("idle");return}o=null;try{ee("scoring");const i=await en(n.stopSession({sessionId:a}),Zn,"Scoring");if(s)return;Gr(i),ee("idle")}catch(i){const l=he(i),d=gt(i);if(console.error(`[pronunciation-coach] stopSession failed (code=${d??"—"}):`,l),ee("idle"),d==="LOAD_FAILED"){I=!1,R.disabled=!0,h.textContent="Model needs reinstall",q(`${J(M)} model failed to load — opening setup so you can reinstall.`),Ht().catch(g=>{console.error("[pronunciation-coach] openModelSetup after LOAD_FAILED:",g)});return}if(d==="NETWORK"){q("Brief network blip while scoring. Try again — your model is fine.");return}q(`Scoring failed: ${l}`)}};R.addEventListener("click",()=>{ne==="idle"?fn().catch(a=>{console.error("[pronunciation-coach] startRecording threw:",a)}):ne==="recording"&&yn().catch(a=>{console.error("[pronunciation-coach] stopRecording threw:",a)})}),w.addEventListener("click",()=>{et(),r!=null&&r.onClose?r.onClose():bt()});const vn=async a=>{if(!(n!=null&&n.prepare))return!1;try{const i=await n.prepare({model:Ee(a)});return i.ready?!0:(console.error(`[pronunciation-coach] ensureLoaded(${a}) failed: code=${i.code??"—"} msg=${i.message??""}`),!1)}catch(i){return console.error(`[pronunciation-coach] ensureLoaded(${a}) threw:`,i),!1}},Ht=async()=>{if(oe)return;oe=!0,et(),ee("idle");const a=M,i=I?M:null;console.log(`[pronunciation-coach] openModelSetup: modelMode=${M} modelReady=${I} activeForOverlay=${i??"null"}`);let l;try{l=await ea({currentActive:i,headline:"Parlometron · Models",sub:"These are large, experimental, cutting-edge AI speech models running entirely on your device — no servers, no internet, no privacy compromises. They are also, frankly, not as reliable as you might hope. The bigger ones might crash your phone. The smaller ones might transcribe 'good morning' as 'goldfish moon'. Any of them might surprise you in either direction. Welcome to on-device AI in 2026. Don't take the scoring too seriously. 🤷"})}finally{oe=!1,He()}if(s)return;if(l.kind==="exit"){!I&&a&&await vn(a)&&(I=!0);return}if(l.kind==="cancelled"){ee("idle"),!I&&a&&await vn(a)&&(I=!0);return}if(l.mode===a&&I){ee("idle");return}const d=l.mode,g=J(d),T=me(d),N=(T==null?void 0:T.approxSizeMB)??0;if(N>0&&(n!=null&&n.getStatus))try{const H=(await n.getStatus()).availableMemoryMB??null;if(H!==null&&H<N*.5){console.warn(`[pronunciation-coach] pre-flight refused switch to ${d}: avail=${H}MB target=${N}MB`),ee("idle"),q(`Not enough memory to switch to ${g} right now (${H} MB free, need ~${Math.round(N*1.3)} MB). Close other apps and restart Corpán, then try again. Your current model is still loaded.`);return}}catch(E){console.warn("[pronunciation-coach] pre-flight status check failed; deferring to native gate:",E)}if(I=!1,R.disabled=!0,n!=null&&n.unload&&a&&a!==d){h.textContent=`Unloading ${J(a)}…`,K(`Unloading ${J(a)} model to free memory…`);try{await n.unload()}catch(E){console.warn("[pronunciation-coach] explicit unload before switch failed:",E)}}h.textContent=`Loading ${g} model…`,K(`Loading ${g} model…
This can take 10–30s on first launch.`);try{const E=await Yr(d);I=!0,M=d,Te(),He(),console.log(`[pronunciation-coach] WhisperKit prepared: ${E.model} (${g})`),Y(),R.disabled=!1,ee("idle")}catch(E){const H=he(E),W=gt(E),L=E instanceof hn;if(console.error(`[pronunciation-coach] post-setup load ${L?"cancelled":"failed"} (code=${W??"—"}):`,L?"user cancel":H),a&&a!==d)try{const j=await Nt(a);I=!0,M=a,He(),Y(),R.disabled=!1,ee("idle"),q(L?`Switch to ${g} cancelled. Staying on ${J(a)}.`:W==="MODEL_NOT_INSTALLED"?`${g} isn't installed yet. Staying on ${J(a)}.`:W==="NETWORK"?`${g} needs internet to finish setting up. Reconnect and try again — staying on ${J(a)} for now.`:W==="INSUFFICIENT_MEMORY"?`Not enough memory to load ${g}. Close other apps and restart Corpán, then try the switch again. Reverted to ${J(a)}.`:`Couldn't switch to ${g}: ${H}. Staying on ${J(a)}.`),console.log(`[pronunciation-coach] reverted to ${j.model} (${J(a)}) after switch failure`);return}catch(j){console.error("[pronunciation-coach] revert to previous model also failed:",j)}Y(),q(L?`Switch to ${g} cancelled.`:W==="MODEL_NOT_INSTALLED"?`${g} model isn't fully installed (likely a partial download). Tap the model badge to reinstall.`:W==="NETWORK"?`${g} needs internet to finish setting up. Reconnect and try again.`:W==="INSUFFICIENT_MEMORY"?`Not enough memory to load ${g}. Close other apps and restart Corpán, then try again.`:`Could not load ${g} model: ${H}`),h.textContent="Model unavailable"}};y.addEventListener("click",()=>{Ht().catch(a=>{console.error("[pronunciation-coach] openModelSetup threw:",a)})});let $t=!1,zt=0,bn=0,wn=0,kt=0,Dt=0,tt=!1,Ft=!1,nt=null,Et=!1;const Kr=()=>{if(k)try{const a=t.speak(k.targetLang,k.target.text);a&&typeof a.catch=="function"&&a.catch(i=>{console.error("[pronunciation-coach] speak phrase failed:",i)})}catch(a){console.error("[pronunciation-coach] speak phrase threw:",a)}},Vr=a=>!a||!(a instanceof Element)?!1:!!a.closest("button, input, textarea, select, a, [data-no-swipe]"),Ue=S;Ue.addEventListener("pointerdown",a=>{ne!=="scoring"&&(Vr(a.target)||a.pointerType==="mouse"&&a.button!==0||($t=!0,zt=a.clientX,bn=a.clientY,kt=a.clientX,Dt=a.clientY,wn=performance.now(),tt=!1,Ft=!1,nt=null,b.classList.add("dragging")))},{passive:!0}),Ue.addEventListener("pointermove",a=>{if(!$t)return;kt=a.clientX,Dt=a.clientY;const i=kt-zt,l=Dt-bn;if(!tt&&!Ft)if(Math.abs(i)>12&&Math.abs(i)>Math.abs(l)*1.2){tt=!0;try{Ue.setPointerCapture(a.pointerId),nt=a.pointerId}catch{}}else Math.abs(l)>12&&(Ft=!0);if(tt){const d=i*.9;b.style.transition="none",b.style.transform=`translateX(${d}px) rotate(${d*.01}deg)`,b.style.opacity=String(Math.max(.4,1-Math.abs(i)/400))}},{passive:!0});const Sn=()=>{if(!$t)return;if($t=!1,b.classList.remove("dragging"),nt!==null){try{Ue.releasePointerCapture(nt)}catch{}nt=null}if(!tt){b.style.transition="transform 200ms ease, opacity 200ms ease",b.style.transform="",b.style.opacity="";return}const a=kt-zt,i=Math.max(1,performance.now()-wn),l=Math.abs(a)/i,d=Math.abs(a)>=Vn,g=l>=Xn;d||g?(Et=!0,window.setTimeout(()=>{Et=!1},500),a<0?Lt().catch(T=>console.error("[pronunciation-coach] swipe-next failed:",T)):U>0?mn().catch(T=>console.error("[pronunciation-coach] swipe-prev failed:",T)):(b.style.transition="transform 220ms ease, opacity 220ms ease",b.style.transform="",b.style.opacity="")):(b.style.transition="transform 220ms ease, opacity 220ms ease",b.style.transform="",b.style.opacity="")};Ue.addEventListener("pointerup",Sn,{passive:!0}),Ue.addEventListener("pointercancel",Sn,{passive:!0}),F.addEventListener("click",a=>{if(Et){Et=!1;return}const i=a.target;i&&(i.closest("button, input, a")||i.closest(".pc-target, .pc-romanization")&&Kr())});const Ln=a=>{a.key==="ArrowLeft"?mn().catch(i=>console.error("[pronunciation-coach] arrow-left failed:",i)):a.key==="ArrowRight"?Lt().catch(i=>console.error("[pronunciation-coach] arrow-right failed:",i)):a.key==="Escape"?bt():(a.key===" "||a.code==="Space")&&(a.preventDefault(),ne==="idle"&&I&&k?fn().catch(i=>console.error("[pronunciation-coach] space-start failed:",i)):ne==="recording"&&yn().catch(i=>console.error("[pronunciation-coach] space-stop failed:",i)))};window.addEventListener("keydown",Ln);const Xr=700,Qr=8;let rt=null,We=null,at=null;const je=()=>{rt!==null&&(window.clearTimeout(rt),rt=null),We=null,at=null},$n=a=>{var d,g;const i=(g=(d=a.target)==null?void 0:d.closest)==null?void 0:g.call(d,"[data-pc-lang-badge]");if(!i)return;const l=i.getAttribute("data-pc-lang")||"";l&&(We={x:a.clientX,y:a.clientY},at=l,rt=window.setTimeout(()=>{rt=null,at&&!s&&Pn(at),at=null,We=null},Xr))},kn=a=>{if(!We)return;const i=a.clientX-We.x,l=a.clientY-We.y;Math.hypot(i,l)>Qr&&je()};e.addEventListener("pointerdown",$n),e.addEventListener("pointermove",kn),e.addEventListener("pointerup",je),e.addEventListener("pointercancel",je);const Jr=()=>{const a=on(de);if(!a||!a.phrases||a.phrases.length===0)return!1;ce=Math.max(0,Math.floor(a.streak)),V.length=0;for(const l of a.phrases)V.push(tr(l));const i=Math.max(0,Math.min(V.length-1,a.idx));return U=i,k=V[i],k&&se(),Je(),!0},Zr=async()=>{const a=t.getStackConfig();if(!a.languages||a.languages.length<2){k=null,G(b,"Set up at least one target language","Open Corpán settings and add a target language to start practising."),R.disabled=!0,h.textContent="—";return}if(Jr()){console.log(`[pronunciation-coach] restored ${V.length} phrase(s) from storage; idx=${U}, streak=${ce}`),we();return}try{const i=await Fe();if(s)return;if(!i){q("No phrases available — check your stack config.");return}V.push(i),U=0,k=i,se(),Te(),we()}catch(i){console.error("[pronunciation-coach] loadFirstPhrase failed:",i),k=null,q(`Could not load a phrase: ${he(i)}`),R.disabled=!0,h.textContent="—"}},ea=a=>new Promise(i=>{let{currentActive:l}=a;const d=document.createElement("div");d.className="pc-setup-root",d.innerHTML=`
        <div class="pc-backdrop"></div>
        <div class="pc-setup">
          <div class="pc-setup-header">
            <div class="pc-subtitle">Speech Models</div>
            <button class="pc-close" id="pc-setup-close" type="button" aria-label="Close">×</button>
          </div>
          <div class="pc-setup-body">
            <h1 class="pc-setup-headline">${Z(a.headline)}</h1>
            <p class="pc-setup-sub">${Z(a.sub)}</p>

            ${Ct().map(p=>{const C=p.approxSizeMB>=1e3?`~${(p.approxSizeMB/1e3).toFixed(1)} GB`:`~${p.approxSizeMB} MB`;return`
            <div class="pc-setup-card" data-mode="${p.id}">
              <div class="pc-setup-card-head">
                <div>
                  <div class="pc-setup-card-name">${Z(p.label)} <span class="pc-setup-card-status" data-status="${p.id}"></span></div>
                  <div class="pc-setup-card-meta">${C}</div>
                </div>
                <div class="pc-setup-card-actions" data-actions="${p.id}"></div>
              </div>
              <div class="pc-setup-card-desc">${Z(p.shortDesc)}</div>
              <div class="pc-setup-card-procon">
                <ul class="pc-setup-card-pros">
                  ${p.pros.map(X=>`<li>${Z(X)}</li>`).join("")}
                </ul>
                <ul class="pc-setup-card-cons">
                  ${p.cons.map(X=>`<li>${Z(X)}</li>`).join("")}
                </ul>
              </div>
              <div class="pc-setup-card-techid" title="Underlying model file (whisper.cpp ggml format)">${Z(p.folder)}</div>
              <div class="pc-setup-progress" data-progress="${p.id}" hidden>
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
      `,e.appendChild(d);const g=d.querySelector(".pc-setup-body"),T=d.querySelector(".pc-setup-card");let N=null;const E=()=>{if(Jt()){N&&(N.remove(),N=null);return}if(N||!g)return;N=Kn({title:"Model downloads need internet",subtitle:"Already-installed models still work. Reconnect to install or reinstall a model."}).element,N.style.marginBottom="12px",T&&T.parentNode===g?g.insertBefore(N,T):g.appendChild(N)};E();let H=()=>{};const W=d.querySelector("#pc-setup-error"),L=Object.fromEntries(Ct().map(p=>[p.id,p.id===l?!0:null]));let j=null;const pe=(p,C)=>{const X=d.querySelector(`[data-progress="${p}"]`);X&&(X.hidden=!C)},ve=(p,C,X)=>{const _=d.querySelector(`[data-progress="${p}"]`);if(!_)return;const te=_.querySelector(".pc-setup-progress-fill");te&&(te.style.width=`${Math.round(Math.max(0,Math.min(1,C))*100)}%`);const re=_.querySelector(".pc-setup-progress-label");re&&(re.textContent=X)},ot=()=>{H(),d.parentNode&&d.parentNode.removeChild(d)},Se=()=>{for(const p of qe){const C=p.id,X=d.querySelector(`[data-status="${C}"]`),_=d.querySelector(`[data-actions="${C}"]`);if(!X||!_)continue;const te=l===C,re=j===C,Le=te?!0:L[C],_e=Le===null&&!te&&!re;if(X.textContent=re?"Installing…":te?"Active":_e?"Checking…":Le?"Installed":"Not installed",X.dataset.state=re?"installing":te?"active":_e?"checking":Le?"installed":"absent",_.innerHTML="",re||_e)continue;const Pe=(Ut,Tt,$e,Wt={})=>{const Re=document.createElement("button");Re.type="button",Re.className=`pc-setup-btn pc-setup-btn-${Tt}`,Re.textContent=Ut,Wt.disabled&&(Re.disabled=!0),Re.addEventListener("click",$e),_.appendChild(Re)},xt=!Jt();Le?te||(Pe("Use this","primary",()=>{console.log(`[pronunciation-coach] CLICK Use-this mode=${C}`),Ce(C)}),Pe("Reinstall","ghost",()=>{console.log(`[pronunciation-coach] CLICK Reinstall mode=${C}`),it(C,!0)},{disabled:xt}),Pe("Remove","danger",()=>{console.log(`[pronunciation-coach] CLICK Remove mode=${C}`),Mt(C)})):Pe("Install","primary",()=>{console.log(`[pronunciation-coach] CLICK Install mode=${C}`),it(C)},{disabled:xt})}};H=Gn(()=>{E(),Se()});const st=async()=>{if(n!=null&&n.validateModel){for(const p of qe){if(l===p.id){L[p.id]=!0;continue}try{const C=await n.validateModel({model:p.folder});L[p.id]=C.valid}catch(C){console.error(`[pronunciation-coach] validate ${p.id} failed:`,C),L[p.id]=!1}}Se()}},Ce=p=>{ot(),i({kind:"selected",mode:p})},Mt=async p=>{if(j||!(n!=null&&n.wipeModel))return;console.log(`[pronunciation-coach] removeModel: mode=${p} folder=${Ee(p)} currentActive=${l??"null"} installed[${p}]=${L[p]}`);const C=L[p];j=p,Se(),W.hidden=!0;try{await n.wipeModel({model:Ee(p)}),L[p]=!1,l===p&&(l=null)}catch(X){L[p]=C;const _=he(X);W.textContent=`Remove failed: ${_}`,W.hidden=!1}finally{j=null,Se()}},it=async(p,C=!1)=>{var X;if(!(j||s||!(n!=null&&n.installModel))){if(j=p,W.hidden=!0,W.textContent="",Se(),pe(p,!0),C&&(n!=null&&n.wipeModel)){ve(p,0,"Wiping previous install…");try{await n.wipeModel({model:Ee(p)})}catch(_){console.warn("[pronunciation-coach] pre-reinstall wipe failed (continuing):",_)}}ve(p,0,"Starting…");try{if(await n.installModel({model:Ee(p),downloadUrl:(X=me(p))==null?void 0:X.downloadUrl},_=>{if(_.model===Ee(p))if(_.phase==="downloading"){let re=`Downloading ${Math.round((_.fraction??0)*100)}%`;if(_.completed!=null&&_.total&&_.total>0){const Le=_e=>(_e/1048576).toFixed(0);re+=` · ${Le(_.completed)} / ${Le(_.total)} MB`}ve(p,_.fraction??0,re)}else _.phase==="verifying"?ve(p,1,"Verifying files…"):_.phase==="verified"?ve(p,1,"Verified ✓"):_.phase==="failed"&&ve(p,0,`Failed: ${_.error??"unknown"}`)}),s)return;L[p]=!0,j=null,ve(p,1,"Verified ✓"),setTimeout(()=>{ot(),i({kind:"selected",mode:p})},300)}catch(_){j=null,pe(p,!1);const te=he(_);if(console.error(`[pronunciation-coach] install ${p} failed:`,te),W.textContent=`Install failed: ${te}`,W.hidden=!1,l&&l!==p&&(n!=null&&n.prepare))try{(await n.prepare({model:Ee(l)})).ready&&console.log(`[pronunciation-coach] restored ${l} kit after ${p} install failed`)}catch(re){console.error(`[pronunciation-coach] kit restore after ${p} install failure threw:`,re)}Se()}}},ct=d.querySelector("#pc-setup-close");if(ct==null||ct.addEventListener("click",()=>{j||(ot(),l&&L[l]?i({kind:"cancelled"}):(bt(),i({kind:"exit"})))}),l){const p=d.querySelector(`[data-mode="${l}"]`);p==null||p.classList.add("pc-setup-card-suggested")}Se(),st().catch(p=>{console.error("[pronunciation-coach] refreshInstallState threw:",p)})});return(async()=>{var W;K("Checking models…");let a;try{a=await n.isAvailable()}catch(L){if(console.error("[pronunciation-coach] stt.isAvailable bridge call threw:",L),s)return;Y(),v("Speech recognition bridge failed",`The native speech-recognition plugin returned an error: ${String(L)}`);return}if(s)return;if(!a){Y(),v();return}try{const L=await n.getStatus();Tn(L.availableMemoryMB??null,L.physicalMemoryMB??null),console.log(`[pronunciation-coach] device memory budget: available=${L.availableMemoryMB??"?"}MB physical=${L.physicalMemoryMB??"?"}MB raw=${JSON.stringify(L)}`)}catch(L){console.warn("[pronunciation-coach] getStatus failed; using conservative budget (Large variants hidden):",L)}const i=on(de);i!=null&&i.mode&&me(i.mode)&&(M=i.mode);const l=me(M);if(l&&Rn(l)){const L=_n().id;console.warn(`[pronunciation-coach] saved model "${M}" exceeds this device's memory budget; demoting to "${L}"`),M=L}He();const d=J(M),g=(((W=me(M))==null?void 0:W.approxSizeMB)??0)>=300;K(g?`Loading ${d} model… first load can take ~1 minute for large models. Subsequent launches are faster.`:`Loading ${d} model…`),h.textContent=g?`Loading ${d} model… (first time can take ~1 minute)`:`Loading ${d} model…`;const T=M;let N=null,E;try{await Promise.all([Nt(T).then(L=>{I=!0,console.log(`[pronunciation-coach] WhisperKit prepared: ${L.model} (${J(T)})`)}),Zr()])}catch(L){N=L,E=gt(L),console.error(`[pronunciation-coach] boot prepare failed (code=${E??"—"}):`,he(L));const j=he(L);!E&&/<model dir missing>|Run install first/i.test(j)&&console.warn("%c[pronunciation-coach] STALE PLUGIN DETECTED","background:#9333ea;color:#fff;padding:2px 6px;border-radius:4px;font-weight:600","\nThe host app is running an old tauri-plugin-stt binary (no `code` field on errors, no marker file).",`
ValidateModel false-negatives in that build trigger destructive wipes on every Install click.`,`
Fix: rebuild and reinstall the host app (cargo tauri ios dev / android dev) to pick up the marker-file fix.`)}if(s)return;if(I&&!N){Y(),ee("idle");return}Y();const H=J(T);if(E==="NETWORK"){q(`${H} needs internet to finish setting up. Reconnect and tap the model badge to retry — your downloaded files are intact.`),R.disabled=!0,h.textContent="Reconnect to load";return}if(E&&E!=="MODEL_NOT_INSTALLED"&&E!=="LOAD_FAILED"){q(`Model failed to load: ${he(N)}`),R.disabled=!0,h.textContent="Model unavailable";return}E==="LOAD_FAILED"&&q(`${H} model failed to load. Use Reinstall in setup if it keeps happening.`),R.disabled=!0,h.textContent=`Loading ${H} model…`,Ht().catch(L=>{console.error("[pronunciation-coach] openModelSetup after boot prepare failure threw:",L)})})().catch(a=>{console.error("[pronunciation-coach] boot threw:",a)}),{unmount:()=>{s=!0,et(),window.removeEventListener("keydown",Ln),e.removeEventListener("pointerdown",$n),e.removeEventListener("pointermove",kn),e.removeEventListener("pointerup",je),e.removeEventListener("pointercancel",je),je(),Y(),f(),e.innerHTML=""}}},It=3,cn="pc:parlometron:game-state",mr=()=>{try{return crypto.randomUUID()}catch{return`p_${Math.random().toString(36).slice(2,10)}_${Date.now()}`}},At=e=>({id:mr(),name:e}),fr=(e,t)=>{if(e.length<2)throw new Error("Parlometron needs at least 2 players");return{players:e.map(r=>({...r})),winTarget:t,currentRound:0,currentRoundOrder:[],currentPlayerIdx:0,attemptsLeft:{},bestThisRound:{},expectedTextThisRound:"",roundsWon:Object.fromEntries(e.map(r=>[r.id,0])),history:[]}},hr=e=>{const t=e.slice();for(let r=t.length-1;r>0;r--){const n=Math.floor(Math.random()*(r+1));[t[r],t[n]]=[t[n],t[r]]}return t},gr=(e,t)=>(e.currentRound+=1,e.currentRoundOrder=hr(e.players.map(r=>r.id)),e.currentPlayerIdx=0,e.attemptsLeft=Object.fromEntries(e.players.map(r=>[r.id,It])),e.bestThisRound=Object.fromEntries(e.players.map(r=>[r.id,null])),e.expectedTextThisRound=t,e),yr=(e,t,r)=>{const n=e.currentRoundOrder[e.currentPlayerIdx];if(!n||(e.attemptsLeft[n]??0)<=0)return e;const s=e.bestThisRound[n],o=Math.max(0,Math.min(100,Math.round(t)));return(!s||o>s.bestPercent)&&(e.bestThisRound[n]={playerId:n,bestPercent:o,heardText:r}),e.attemptsLeft[n]=Math.max(0,(e.attemptsLeft[n]??0)-1),e},vr=e=>{const t=e.currentRoundOrder[e.currentPlayerIdx];return t&&(e.attemptsLeft[t]=0),e.currentPlayerIdx+=1,e},br=e=>e.currentPlayerIdx>=e.currentRoundOrder.length,wr=e=>e.players.some(t=>(e.roundsWon[t.id]??0)>=e.winTarget),Sr=e=>{let t=-1;for(const r of e.players){const n=e.roundsWon[r.id]??0;n>t&&(t=n)}return t<1?[]:e.players.filter(r=>(e.roundsWon[r.id]??0)===t)},Lr=e=>{var o;const t=e.players.map(c=>e.bestThisRound[c.id]??{playerId:c.id,bestPercent:0,heardText:""}).sort((c,u)=>u.bestPercent-c.bestPercent),r=((o=t[0])==null?void 0:o.bestPercent)??0,n=r>0?t.filter(c=>c.bestPercent===r).map(c=>c.playerId):[];for(const c of n)e.roundsWon[c]=(e.roundsWon[c]??0)+1;const s={round:e.currentRound,expectedText:e.expectedTextThisRound,results:t,winnerIds:n};return e.history.push(s),{state:e,round:s}},Pt=e=>{const t=e.currentRoundOrder[e.currentPlayerIdx];return t?e.players.find(r=>r.id===t)??null:null},wt=e=>{try{localStorage.setItem(cn,JSON.stringify(e))}catch(t){console.error("[parlometron/state] save failed:",t)}},Ve=()=>{try{localStorage.removeItem(cn)}catch(e){console.error("[parlometron/state] clear failed:",e)}},St=2,Xe=8,ln=e=>e.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/'/g,"&#39;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),$r=e=>{var w,D;const t=((w=e.initial)==null?void 0:w.players.map(m=>({...m})))??[At("Player 1"),At("Player 2")];let r=((D=e.initial)==null?void 0:D.winTarget)??5;const n=()=>{const m=[3,5,7].map(y=>`
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
          <h3 class="pc-pm-section-title">Players (${t.length} / ${Xe})</h3>
          <ul class="pc-pm-roster" id="pc-pm-roster">${s()}</ul>
          <button class="pc-pm-add" data-pm-add
                  ${t.length>=Xe?"disabled":""}>
            + Add Player
          </button>
        </section>

        <section class="pc-pm-section">
          <h3 class="pc-pm-section-title">First to win</h3>
          <div class="pc-pm-target-row">
            ${m}
            <span class="pc-pm-target-suffix">rounds</span>
          </div>
        </section>

        <footer class="pc-pm-foot">
          <button class="pc-pm-start" id="pc-pm-start" disabled>
            Start game
          </button>
        </footer>
      </div>
    `,v(),o()},s=()=>t.map((m,y)=>`
        <li class="pc-pm-roster-row" data-pm-row="${m.id}">
          <span class="pc-pm-roster-num">${y+1}</span>
          <input type="text"
                 class="pc-pm-roster-name"
                 data-pm-name="${m.id}"
                 value="${ln(m.name)}"
                 maxlength="24"
                 placeholder="Player name"
                 autocapitalize="words"
                 autocorrect="off"
                 spellcheck="false" />
          <button class="pc-pm-roster-remove"
                  data-pm-remove="${m.id}"
                  aria-label="Remove ${ln(m.name)}"
                  ${t.length<=St?"disabled":""}>×</button>
        </li>`).join(""),o=()=>{const m=e.container.querySelector("#pc-pm-start");if(!m)return;const y=t.every(S=>S.name.trim().length>0);m.disabled=!y||t.length<St},c=()=>{const m=e.container.querySelector("[data-pm-add]");m&&(m.disabled=t.length>=Xe)},u=()=>{const m=e.container.querySelector("#pc-pm-roster");m&&(m.innerHTML=s());const y=e.container.querySelector(".pc-pm-section-title");y&&(y.textContent=`Players (${t.length} / ${Xe})`),f(),c(),o()},f=()=>{e.container.querySelectorAll("[data-pm-name]").forEach(m=>{const y=m.getAttribute("data-pm-name")||"";m.addEventListener("input",()=>{const S=t.find(F=>F.id===y);S&&(S.name=m.value),o()})}),e.container.querySelectorAll("[data-pm-remove]").forEach(m=>{m.addEventListener("click",()=>{if(t.length<=St)return;const y=m.getAttribute("data-pm-remove")||"",S=t.findIndex(F=>F.id===y);S>=0&&(t.splice(S,1),u())})})},v=()=>{var m,y,S;(m=e.container.querySelector("[data-pm-back]"))==null||m.addEventListener("click",()=>e.onBack()),(y=e.container.querySelector("[data-pm-add]"))==null||y.addEventListener("click",()=>{t.length>=Xe||(t.push(At(`Player ${t.length+1}`)),u())}),e.container.querySelectorAll("[data-pm-target]").forEach(F=>{F.addEventListener("click",()=>{const b=Number(F.getAttribute("data-pm-target"));(b===3||b===5||b===7)&&(r=b,e.container.querySelectorAll("[data-pm-target]").forEach(R=>{R.classList.toggle("active",Number(R.getAttribute("data-pm-target"))===b)}))})}),(S=e.container.querySelector("#pc-pm-start"))==null||S.addEventListener("click",()=>{const F=t.map(R=>({...R,name:R.name.trim()})).filter(R=>R.name.length>0);if(F.length<St)return;const b=fr(F,r);e.onStart(b)}),f()};return n(),{unmount:()=>{e.container.innerHTML=""}}},Ot=e=>e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),dn=e=>new Promise(t=>{var o,c,u;const r=document.createElement("div");r.className="pc-pm-confirm-root",r.innerHTML=`
      <div class="pc-pm-confirm-backdrop" data-pm-confirm-backdrop></div>
      <div class="pc-pm-confirm-sheet" role="alertdialog" aria-modal="true">
        <p class="pc-pm-confirm-msg">${Ot(e.message)}</p>
        <div class="pc-pm-confirm-foot">
          <button class="pc-pm-confirm-cancel" data-pm-confirm-cancel>
            ${Ot(e.cancelLabel??"Cancel")}
          </button>
          <button class="pc-pm-confirm-go ${e.destructive?"danger":""}"
                  data-pm-confirm-go>
            ${Ot(e.confirmLabel??"Confirm")}
          </button>
        </div>
      </div>`,document.body.appendChild(r),requestAnimationFrame(()=>r.classList.add("open"));const n=f=>{r.classList.remove("open"),window.setTimeout(()=>{r.parentNode&&r.parentNode.removeChild(r)},200),window.removeEventListener("keydown",s),t(f)},s=f=>{f.key==="Escape"?n(!1):f.key==="Enter"&&n(!0)};window.addEventListener("keydown",s),(o=r.querySelector("[data-pm-confirm-backdrop]"))==null||o.addEventListener("click",()=>n(!1)),(c=r.querySelector("[data-pm-confirm-cancel]"))==null||c.addEventListener("click",()=>n(!1)),(u=r.querySelector("[data-pm-confirm-go]"))==null||u.addEventListener("click",()=>n(!0))}),kr=9e4,Er=()=>`pm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`,Qe=e=>e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),Mr=e=>Qe(e).replace(/"/g,"&quot;").replace(/'/g,"&#39;"),xr=e=>e?e.split("-")[0].toLowerCase():"en",Tr=async(e,t,r)=>{let n=null;const s=new Promise((o,c)=>{n=setTimeout(()=>{c(new Error(`${r} timed out after ${Math.round(t/1e3)}s`))},t)});try{return await Promise.race([e,s])}finally{n&&clearTimeout(n)}},Cr=(e,t)=>{const r=t.length>0?e.translations.find(o=>o.language_code===t[0])??null:null,n=[];for(const o of t.slice(1)){const c=e.translations.find(u=>u.language_code===o);c&&n.push(c)}return{target:n.length>0?n[Math.floor(Math.random()*n.length)]:null,native:r}},_r=e=>{var xe;const t=e.hostApi.stt;if(!t)return e.container.innerHTML=`
      <div class="pc-pm-root pc-pm-error">
        <p>Whisper STT is not available on this device.</p>
        <button class="pc-pm-start" data-pm-quit>Back</button>
      </div>`,(xe=e.container.querySelector("[data-pm-quit]"))==null||xe.addEventListener("click",e.onQuit),{unmount:()=>e.container.innerHTML=""};let r=!1,n="loading",s=null,o=null,c=null,u=null,f=null;const v=()=>{var $,x,B,ae;e.container.innerHTML=`
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
      </div>`,($=e.container.querySelector("[data-pm-quit]"))==null||$.addEventListener("click",async()=>{await dn({message:"Quit this game? Scores will be lost.",confirmLabel:"Quit",cancelLabel:"Keep playing",destructive:!0})&&(s&&(t.cancelSession({sessionId:s}).catch(P=>console.error("[parlometron/round] cancel failed:",P)),s=null),e.onQuit())}),(x=e.container.querySelector("[data-pm-mic]"))==null||x.addEventListener("click",m),(B=e.container.querySelector("[data-pm-pass]"))==null||B.addEventListener("click",b),(ae=e.container.querySelector("[data-pm-splash-go]"))==null||ae.addEventListener("click",()=>{n="ready",w()});const h=e.container.querySelector("[data-pm-target]");h&&h.addEventListener("click",()=>{const z=o==null?void 0:o.text,P=o==null?void 0:o.language_code;if(!(!z||!P))try{const K=e.hostApi.speak(P,z);K&&typeof K.catch=="function"&&K.catch(Y=>console.error("[parlometron/round] phrase speak failed:",Y))}catch(K){console.error("[parlometron/round] phrase speak threw:",K)}})},w=()=>{if(r)return;const h=Pt(e.game),$=h?e.game.attemptsLeft[h.id]??0:0,x=It-$,B=h?e.game.currentRoundOrder.indexOf(h.id)+1:e.game.currentRoundOrder.length,ae=e.game.currentRoundOrder.length,z=M=>e.container.querySelector(M),P=z("[data-pm-eyebrow]");if(P){const M=o!=null&&o.language_code?o.language_code.split("-")[0].toUpperCase():"",oe=M?` · ${M}`:"";P.textContent=`Round ${e.game.currentRound}${oe} · First to ${e.game.winTarget}`}const K=z("[data-pm-headline]");K&&(K.textContent=`${(h==null?void 0:h.name)??"—"}'s turn`);const Y=z("[data-pm-turn]");Y&&(Y.textContent=`${B} / ${ae}`);const q=z("[data-pm-target]");q&&(q.textContent=(o==null?void 0:o.text)??"Loading…");const ge=z("[data-pm-roman]");if(ge){const oe=!!e.hostApi.getStackConfig().showRomanization,de=((o==null?void 0:o.romanization)??"").trim();oe&&de?(ge.textContent=de,ge.hidden=!1):ge.hidden=!0}const ne=z("[data-pm-native]");if(ne){const M=((c==null?void 0:c.text)??"").trim();M?(ne.textContent=M,ne.hidden=!1):ne.hidden=!0}D();const I=z("[data-pm-mic]"),k=z("[data-pm-mic-label]"),V=z("[data-pm-tries]");I&&(I.classList.remove("recording","scoring"),I.disabled=n==="scoring"||n==="loading",n==="recording"?I.classList.add("recording"):n==="scoring"&&I.classList.add("scoring")),k&&(k.textContent=n==="loading"?"Loading…":n==="passing"?`${(h==null?void 0:h.name)??"—"}, get ready`:n==="recording"?"Tap to stop":n==="scoring"?"Scoring…":n==="result"&&$>0?"Tap to try again":n==="result"?"Tap mic or pass":"Tap to speak"),V&&(V.innerHTML=Array.from({length:It},(M,oe)=>`<span class="pc-pm-try-dot ${oe<x?"used":""}"></span>`).join(""));const U=z("[data-pm-pass]");U&&U.classList.toggle("is-invisible",n!=="result");const ye=z("[data-pm-splash]"),ce=z("[data-pm-splash-name]");ye&&(ye.hidden=n!=="passing"),ce&&(ce.textContent=(h==null?void 0:h.name)??"next player")},D=()=>{var Ze;const h=e.container.querySelector("[data-pm-banner]"),$=e.container.querySelector("[data-pm-transcript]"),x=e.container.querySelector("[data-pm-detail]");if(!h||!$||!x)return;if(f&&!u){h.className="pc-result-banner bad",h.innerHTML=`<span class="pc-result-banner-text">${Qe(f)}</span>`,h.hidden=!1,$.hidden=!0,x.hidden=!0,$.innerHTML="",x.innerHTML="";return}if(!u||n!=="result"){h.hidden=!0,$.hidden=!0,x.hidden=!0,h.innerHTML="",$.innerHTML="",x.innerHTML="";return}const B=u,ae=Math.max(0,Math.min(1,B.overallScore)),z=Math.round(ae*100),P=ae>=.85?"good":ae>=.6?"okay":"bad",K=P==="good"?"Nailed it":P==="okay"?"Close — try again":"";h.className=`pc-result-banner ${P}`,h.innerHTML=K?`
      <span class="pc-result-banner-score">${z}%</span>
      <span class="pc-result-banner-sep">·</span>
      <span class="pc-result-banner-text">${Qe(K)}</span>`:`<span class="pc-result-banner-score">${z}%</span>`,h.hidden=!1;const Y=(B.freeText||B.text||"").trim(),q=nn((o==null?void 0:o.language_code)??B.language??""),ge=q?"pc-transcript-line pc-transcript-line-rtl":"pc-transcript-line",ne=q?"◀":"▶";Y?($.innerHTML=`
        <div class="pc-transcripts">
          <div class="pc-transcript-row heard" role="button" tabindex="0"
               data-pm-speak-heard
               aria-label="Play what Whisper heard">
            <span class="pc-transcript-label">Heard you say</span>
            <span class="${ge}">
              <span class="pc-transcript-play" aria-hidden="true">${ne}</span>
              <span class="pc-transcript-text">${Qe(Y)}</span>
            </span>
          </div>
        </div>`,$.hidden=!1,(Ze=$.querySelector("[data-pm-speak-heard]"))==null||Ze.addEventListener("click",()=>{const O=o==null?void 0:o.language_code;if(O)try{const G=e.hostApi.speak(O,Y);G&&typeof G.catch=="function"&&G.catch(se=>console.error("[parlometron/round] heard speak failed:",se))}catch(G){console.error("[parlometron/round] heard speak threw:",G)}})):($.innerHTML="",$.hidden=!0);const I=((o==null?void 0:o.text)??"").trim(),k=(o==null?void 0:o.language_code)??B.language??"",V=rn(B.words??[]),U=yt(I),ye=yt(Y),ce=U.length>0&&U.length===V.length,M=U.length>0&&U.length===ye.length,oe=Y.length&&I.length?vt(Me(Y,k),Me(I,k)):null,de=U.length?U.map((O,G)=>({word:O,heardProb:ce?V[G].probability:null,freeSim:M?vt(Me(O,k),Me(ye[G],k)):oe})):I?[{word:I,heardProb:null,freeSim:oe}]:[],Te=O=>O===null?null:O>=.9?"good":O>=.6?"okay":"bad",He=O=>O===null?null:O>=.85?"good":O>=.6?"okay":"bad",Je={bad:0,okay:1,good:2},ee=O=>{const G=Te(O.heardProb),se=He(O.freeSim);return G===null&&se===null?"":G===null?se:se===null||Je[G]<=Je[se]?G:se},ze=de.map((O,G)=>`<button class="pc-word ${ee(O)}" type="button"
                   data-pm-word-idx="${G}"
                   aria-label="Speak ${Mr(O.word)}">${Qe(O.word)}</button>`).join(""),be=q?"pc-words pc-words-rtl":"pc-words";x.innerHTML=ze?`<div class="${be}">${ze}</div>`:"",x.hidden=!ze,x.querySelectorAll("[data-pm-word-idx]").forEach(O=>{O.addEventListener("click",()=>{var Fe;const G=Number(O.getAttribute("data-pm-word-idx")),se=(Fe=de[G])==null?void 0:Fe.word.trim(),De=o==null?void 0:o.language_code;if(!(!se||!De))try{const we=e.hostApi.speak(De,se);we&&typeof we.catch=="function"&&we.catch(Lt=>console.error("[parlometron/round] word speak failed:",Lt))}catch(we){console.error("[parlometron/round] word speak threw:",we)}})})},m=()=>{n==="ready"?S():n==="recording"?F():n==="result"&&y()?(u=null,n="ready",w(),S()):n==="result"&&b()},y=()=>{const h=Pt(e.game);return h?(e.game.attemptsLeft[h.id]??0)>0:!1},S=async()=>{if(r||!Pt(e.game))return;const $=Er();s=$,u=null,f=null,n="recording",w();try{const x=xr((o==null?void 0:o.language_code)??"en"),B=await t.startSession({sessionId:$,language:x,expectedText:(o==null?void 0:o.text)??"",whisperParams:Xt(x)});if(r)return;if(!B.started)throw new Error("STT did not start")}catch(x){console.error("[parlometron/round] startSession failed:",x),s=null,n="ready",w()}},F=async()=>{if(r)return;const h=s;if(h){s=null,n="scoring",w();try{const $=await Tr(t.stopSession({sessionId:h}),kr,"Scoring");if(r)return;const x=Math.round(Math.max(0,Math.min(1,$.overallScore))*100),B=$.text||$.freeText||"";yr(e.game,x,B),wt(e.game),u=$,n="result",w()}catch($){const x=($==null?void 0:$.message)??String($),B=$==null?void 0:$.code;if(console.error(`[parlometron/round] stopSession failed (code=${B??"—"}):`,x),r)return;f=B==="NOT_PREPARED"||/not prepared/i.test(x)?"Speech model isn't loaded yet. Open Practice once to install it.":`Couldn't score this attempt: ${x}`,u=null,n="ready",w()}}},b=()=>{if(!r){if(vr(e.game),wt(e.game),br(e.game)){const{round:h}=Lr(e.game);wt(e.game),e.onRoundDone(h);return}u=null,f=null,n="passing",w()}};return(async()=>{var h,$,x;v(),n="loading",w();try{const B=e.hostApi.getStackConfig();if(!B.languages||B.languages.length<2){e.container.innerHTML=`
          <div class="pc-pm-root pc-pm-error">
            <p>Add a target language to your Corpán stack before starting Parlometron.</p>
            <button class="pc-pm-start" data-pm-quit>Back</button>
          </div>`,(h=e.container.querySelector("[data-pm-quit]"))==null||h.addEventListener("click",e.onQuit);return}const ae=e.hostApi.getRandomEntry;if(!ae)throw new Error("hostApi.getRandomEntry unavailable");const z=await ae();if(r)return;const{target:P,native:K}=Cr(z,B.languages);if(!P){e.container.innerHTML=`
          <div class="pc-pm-root pc-pm-error">
            <p>This phrase doesn't have a translation in your target language.</p>
            <button class="pc-pm-start" data-pm-quit>Back</button>
          </div>`,($=e.container.querySelector("[data-pm-quit]"))==null||$.addEventListener("click",e.onQuit);return}o=P,c=K,gr(e.game,P.text),wt(e.game),n="passing",w()}catch(B){if(console.error("[parlometron/round] boot failed:",B),r)return;e.container.innerHTML=`
        <div class="pc-pm-root pc-pm-error">
          <p>Couldn't load a phrase. Try again later.</p>
          <button class="pc-pm-start" data-pm-quit>Back</button>
        </div>`,(x=e.container.querySelector("[data-pm-quit]"))==null||x.addEventListener("click",e.onQuit)}})(),{unmount:()=>{r=!0,s&&(t.cancelSession({sessionId:s}).catch(h=>console.error("[parlometron/round] unmount cancel:",h)),s=null),e.container.innerHTML=""}}},Ae=e=>e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),pn=(e,t)=>e.players.find(r=>r.id===t),Rr=e=>{const{game:t,round:r}=e,n=r.winnerIds.map(u=>{var f;return((f=pn(t,u))==null?void 0:f.name)??"—"}).filter(Boolean),s=n.length===0?"No round winner.":n.length===1?`${n[0]} wins the round`:`${n.join(" & ")} tie for the round`,o=r.results.map(u=>{const f=pn(t,u.playerId),v=r.winnerIds.includes(u.playerId),w=t.roundsWon[u.playerId]??0;return`
        <tr class="${v?"winner":""}">
          <td class="pc-pm-score-name">${Ae((f==null?void 0:f.name)??"—")}</td>
          <td class="pc-pm-score-pct">${u.bestPercent}%</td>
          <td class="pc-pm-score-heard">${Ae((u.heardText||"—").slice(0,60))}</td>
          <td class="pc-pm-score-total">${w}</td>
        </tr>`}).join("");return e.container.innerHTML=`
    <div class="pc-pm-root pc-pm-results">
      <header class="pc-pm-head">
        <div class="pc-pm-head-eyebrow-row">
          <span class="pc-pm-eyebrow">Round ${r.round} · First to ${t.winTarget}</span>
        </div>
        <div class="pc-pm-head-action-row">
          <button class="pc-pm-back" data-pm-quit aria-label="Quit game">‹</button>
          <span class="pc-pm-headline">${Ae(s)}</span>
          <div class="pc-pm-head-spacer"></div>
        </div>
      </header>

      <main class="pc-pm-results-body">
        <p class="pc-pm-results-phrase">
          <span class="pc-pm-results-phrase-label">Phrase</span>
          <span class="pc-pm-results-phrase-text">${Ae(r.expectedText)}</span>
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
    </div>`,(()=>{var f,v,w;const u=async()=>{await dn({message:"Quit this game?",confirmLabel:"Quit",cancelLabel:"Keep playing",destructive:!0})&&e.onQuit()};(f=e.container.querySelector("[data-pm-quit]"))==null||f.addEventListener("click",u),(v=e.container.querySelector("[data-pm-quit2]"))==null||v.addEventListener("click",u),(w=e.container.querySelector("[data-pm-next]"))==null||w.addEventListener("click",()=>e.onNextRound())})(),{unmount:()=>{e.container.innerHTML=""}}},qr=e=>{var c,u;const{game:t}=e,r=Sr(t),n=r.length===0?"Game over":r.length===1?`${r[0].name} wins!`:`${r.map(f=>f.name).join(" & ")} tie!`,o=[...t.players].sort((f,v)=>(t.roundsWon[v.id]??0)-(t.roundsWon[f.id]??0)).map((f,v)=>{const w=t.roundsWon[f.id]??0,D=r.some(S=>S.id===f.id),m=t.history.map(S=>S.results.find(F=>F.playerId===f.id)).filter(S=>!!S),y=m.length?Math.round(m.reduce((S,F)=>S+F.bestPercent,0)/m.length):0;return`
        <tr class="${D?"winner":""}">
          <td class="pc-pm-score-rank">${v+1}</td>
          <td class="pc-pm-score-name">${Ae(f.name)}</td>
          <td class="pc-pm-score-total">${w}</td>
          <td class="pc-pm-score-pct">${y}%</td>
        </tr>`}).join("");return e.container.innerHTML=`
    <div class="pc-pm-root pc-pm-gameover">
      <header class="pc-pm-head pc-pm-gameover-head">
        <div class="pc-pm-head-eyebrow-row">
          <span class="pc-pm-eyebrow">${Ae(`Best of ${t.winTarget*2-1}-ish · ${t.history.length} rounds played`)}</span>
        </div>
        <div class="pc-pm-head-action-row">
          <span class="pc-pm-headline pc-pm-winner">${Ae(n)}</span>
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
    </div>`,(c=e.container.querySelector("[data-pm-done]"))==null||c.addEventListener("click",()=>e.onDone()),(u=e.container.querySelector("[data-pm-again]"))==null||u.addEventListener("click",()=>e.onPlayAgain()),{unmount:()=>{e.container.innerHTML=""}}},Ir="pc:parlometron:last-mode",Ar="corpan-pronunciation-coach:v2",Pr=()=>{let e=null;try{const t=localStorage.getItem(Ar);if(t){const r=JSON.parse(t),n=me(r.mode);n&&(e=n.folder)}}catch(t){console.warn("[parlometron] reading saved model failed:",t)}return e??Kt().folder},Or=e=>{const t=e.stt;if(!(t!=null&&t.prepare))return;const r=Pr();console.log("[parlometron] ensureModelPrepared — calling prepare:",r),t.prepare({model:r}).then(n=>{n.ready?console.log(`[parlometron] model ready: ${n.model??r}`):console.warn(`[parlometron] prepare reported not ready (code=${n.code??"—"}): ${n.message??""}`)}).catch(n=>{console.warn("[parlometron] prepare threw:",n)})},Nr=(e,t)=>{let r=null,n=null,s=null;const o=()=>{if(r){try{r.unmount()}catch(m){console.error("[parlometron] unmount threw:",m)}r=null}},c=()=>{var m;o(),n=null,e.innerHTML=`
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
      </div>`,(m=e.querySelector("[data-pm-picker-close]"))==null||m.addEventListener("click",()=>{try{window.dispatchEvent(new CustomEvent("corpan:exit"))}catch(y){console.error("[parlometron] dispatch exit failed:",y)}}),e.querySelectorAll("[data-pm-mode]").forEach(y=>y.addEventListener("click",()=>{const S=y.getAttribute("data-pm-mode");try{localStorage.setItem(Ir,S??"")}catch{}S==="practice"?u():S==="friends"&&(Ve(),f(s??void 0))})),r={unmount:()=>{e.innerHTML=""}}},u=()=>{o(),r=ur(e,t,{onClose:()=>c()})},f=m=>{o(),r=$r({container:e,onBack:()=>c(),onStart:S=>{n=S,s={players:S.players.map(F=>({...F})),winTarget:S.winTarget},v()},initial:m})},v=()=>{if(!n){c();return}o(),r=_r({container:e,hostApi:t,game:n,onRoundDone:y=>{n&&(wr(n)?D():w(y))},onQuit:()=>{Ve(),n=null,c()}})},w=m=>{if(!n){c();return}o(),r=Rr({container:e,game:n,round:m,onNextRound:()=>v(),onQuit:()=>{Ve(),n=null,c()}})},D=()=>{if(!n){c();return}o(),r=qr({container:e,game:n,onPlayAgain:()=>{const y=s;Ve(),n=null,f(y??void 0)},onDone:()=>{Ve(),n=null,c()}})};return Or(t),c(),{unmount:()=>{var y;o(),e.innerHTML="";const m=t.stt;(y=m==null?void 0:m.releaseAudio)==null||y.call(m).catch(S=>{console.error("[parlometron] releaseAudio failed:",S)})}}},Br="/__console",Hr="8990";function zr(){var r,n;if(typeof document>"u")return null;const e=((n=(r=document.currentScript)==null?void 0:r.dataset)==null?void 0:n.corpGameBaseUrl)??null;if(!e)return null;let t;try{t=new URL(e)}catch{return null}return t.protocol!=="http:"?null:`${t.protocol}//${t.hostname}:${Hr}${Br}`}function Dr(e){if(e==null||typeof e=="string"||typeof e=="number"||typeof e=="boolean")return e;if(e instanceof Error)return{__error:!0,name:e.name,message:e.message,stack:e.stack};try{return JSON.stringify(e),e}catch{try{return String(e)}catch{return"[unserializable]"}}}let un=!1;function Fr(){if(un)return;const e=zr();if(!e)return;un=!0;const t={log:console.log.bind(console),info:console.info.bind(console),warn:console.warn.bind(console),error:console.error.bind(console)},r=(s,o)=>{try{const c=JSON.stringify({level:s,args:o.map(Dr),ts:Date.now()});fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:c,keepalive:!0}).catch(()=>{})}catch{}},n=s=>(...o)=>{r(s,o),t[s](...o)};console.log=n("log"),console.info=n("info"),console.warn=n("warn"),console.error=n("error"),typeof window<"u"&&(window.addEventListener("error",s=>{r("error",["[unhandled error]",s.message,s.filename,`${s.lineno}:${s.colno}`])}),window.addEventListener("unhandledrejection",s=>{r("error",["[unhandled rejection]",String(s.reason)])})),t.log(`[devConsole] forwarding to ${e}`)}Fr();const Ur="pronunciation_coach";(()=>{const e=globalThis,t=e.CorpanGames=e.CorpanGames||{};t[Ur]={mount:(r,n,s)=>{const o=globalThis;o.__pronunciationCoach&&(o.__pronunciationCoach.dispose(),o.__pronunciationCoach=void 0);const c=Nr(r,n),u={dispose:()=>{c.unmount()}};return o.__pronunciationCoach=u,{unmount:()=>{u.dispose(),o.__pronunciationCoach=void 0}}}}})()})();
