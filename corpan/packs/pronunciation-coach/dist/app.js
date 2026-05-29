globalThis.process=globalThis.process||{env:{}};(function(){"use strict";let dt=null,pt=null;const xn=6500,Cn=8e3,_n=(e,t)=>{typeof e=="number"&&Number.isFinite(e)&&e>0&&(dt=e),typeof t=="number"&&Number.isFinite(t)&&t>0&&(pt=t)},Rn=()=>{if(typeof navigator>"u")return!1;const e=navigator.userAgent||"";return/iPad/.test(e)?!0:/iPhone|iPod/.test(e)?!1:!!(/Macintosh/.test(e)&&(navigator.maxTouchPoints??0)>1)},Yt=()=>dt!=null&&dt>=xn||pt!=null&&pt>=Cn?!0:dt==null&&pt==null?Rn():!1,Ie=[{id:"tiny_proof",folder:"ggml-tiny.bin",label:"Tiny",shortDesc:"Tiny is, honestly, kind of terrible. You say 'good morning,' Tiny writes 'good warning.' Mostly useful as the baseline you compare bigger models against.",pros:["Tiniest download","Fast on every device","Works offline like everything here"],cons:["Frequently wrong on real sentences","Especially weak on non-Latin scripts"],approxSizeMB:75,defaultForFreshInstall:!0},{id:"small",folder:"ggml-small.bin",label:"Small",shortDesc:"First model that genuinely works for everyday Spanish, French, German, and friends. Boring, reasonable choice for Latin-script languages.",pros:["Solid for most European languages","Modest size and RAM use"],cons:["Less reliable than the Larges","Drifts on harder or longer sentences"],approxSizeMB:465,defaultForFreshInstall:!1},{id:"large_turbo",folder:"ggml-large-v3-turbo-q5_0.bin",label:"Large Turbo q5",shortDesc:"The smallest 'Large.' Whisper's speedy distilled decoder, weights crushed to 5 bits.",pros:["Smallest of the Large family","Snappy on iOS; the q8 variant is the equivalent pick on Android"],cons:["Slow on Android (5-bit math doesn't play well with Android CPUs — try the q8 Turbo instead)","Distilled decoder is weaker on Telugu / Tamil / other non-Latin scripts"],approxSizeMB:547,defaultForFreshInstall:!1},{id:"large_q8",folder:"ggml-large-v3-turbo-q8_0.bin",label:"Large Turbo q8",shortDesc:"Same Turbo distillation as q5, but at 8-bit precision — math most CPUs prefer. The Turbo sweet spot on Android.",pros:["~2.5× faster than q5 on Android","Better quality than q5","Works well on iOS too"],cons:["Bigger download than q5","Same Turbo weakness on non-Latin scripts"],approxSizeMB:834,defaultForFreshInstall:!1},{id:"large_qlora",folder:"ggml-large-v3-q5_0.bin",label:"Large q5",shortDesc:"Full Whisper Large brain — no Turbo distillation — compressed to 5 bits. Best in our testing for Telugu, Tamil, Bengali, and other non-Latin-script languages.",pros:["Best for Indic and other non-Latin-script languages","Keeps the full 32-layer text decoder","Honest output in the right script"],cons:["~1 GB download","Slower than Turbo on both platforms"],approxSizeMB:1031,defaultForFreshInstall:!1},{id:"medium",folder:"ggml-medium.bin",label:"Full Weight Medium",shortDesc:"Older Whisper architecture at full precision (no compression). Wins occasionally on languages later models quietly got worse at. Usually outdone by Large q5.",pros:["Every weight at native fp16 precision","Occasionally surprises on niche languages"],cons:["Bigger download than Large q5 for usually less quality","Older architecture"],approxSizeMB:1463,defaultForFreshInstall:!1},{id:"large_max",folder:"ggml-large-v3-turbo.bin",label:"Full Weight Large Turbo",shortDesc:"Whisper's speedy Turbo distillation at full 16-bit precision. Where the GPU fp16 fast path is available, it's quick despite the size.",pros:["Fastest 'Large' on iOS (Metal fp16 fast path)","Top quality for Latin-script languages"],cons:["1.5 GB download","CPU-only on Android, so slower there","Same Turbo weakness on Indic — Large q5 or q8 is better for those"],approxSizeMB:1549,defaultForFreshInstall:!1},{id:"large_q8_full",folder:"ggml-large-v3-q8_0.bin",label:"Large q8 ★",shortDesc:"The biggest, baddest model that still fits in app memory — full Whisper Large at 8-bit precision (we quantize this one ourselves from the original fp16, since upstream doesn't ship it). Should be the new best for Indic and other non-Latin-script languages.",pros:["Higher precision than Large q5, same full 32-layer decoder","Expected best quality for Telugu, Tamil, Bengali, etc."],cons:["~1.6 GB download","Slower than Turbo and a bit slower than Large q5","Needs ~3 GB RAM headroom during first transcribe"],approxSizeMB:1580,defaultForFreshInstall:!1,downloadUrl:"https://d38iwc9748jekz.cloudfront.net/whisper-models/ggml-large-v3-q8_0.bin"}],Ct=()=>Yt()?Ie:Ie.filter(e=>!e.requiresLargeMemory),In=()=>{const e=Ct();return e.find(t=>t.defaultForFreshInstall)??e[0]},qn=e=>!!e.requiresLargeMemory&&!Yt(),fe=e=>{if(e)return Ie.find(t=>t.id===e)},Kt=()=>Ie.find(e=>e.defaultForFreshInstall)??Ie[0],Ne={temperature:0,temperature_inc:.2,entropy_thold:2.4,logprob_thold:-1,no_speech_thold:.6,suppress_blank:!0,suppress_nst:!1,n_threads:0,initial_prompt:""},ut={te:{temperature_inc:0,initial_prompt:"నేను తెలుగు నేర్చుకుంటున్నాను. నేను ఒక పదబంధం ప్రయత్నిస్తాను, మీరు విన్నది నిజాయితీగా చెప్పండి."},ta:{temperature_inc:0,initial_prompt:"நான் தமிழ் கற்றுக்கொள்கிறேன். ஒரு சொற்றொடரை முயற்சிக்கப் போகிறேன், நீங்கள் கேட்டதை நேர்மையாகச் சொல்லுங்கள்."},ml:{temperature_inc:0,initial_prompt:"ഞാൻ മലയാളം പഠിക്കുകയാണ്. ഞാൻ ഒരു വാക്യം പറയാൻ പോകുന്നു, നിങ്ങൾ കേട്ടത് സത്യസന്ധമായി പറയൂ."},bn:{temperature_inc:0,initial_prompt:"আমি বাংলা শিখছি। আমি একটি বাক্যাংশ চেষ্টা করব, আপনি যা শুনেছেন তা সততার সাথে বলুন।"},mr:{temperature_inc:0,initial_prompt:"मी मराठी शिकत आहे. मी एक वाक्यांश प्रयत्न करणार आहे, तुम्ही ऐकलेले प्रामाणिकपणे सांगा."},gu:{temperature_inc:0,initial_prompt:"હું ગુજરાતી શીખું છું. હું એક વાક્ય બોલવાનો છું, તમે જે સાંભળ્યું તે પ્રામાણિકતાથી કહો."},pa:{temperature_inc:0,initial_prompt:"ਮੈਂ ਪੰਜਾਬੀ ਸਿੱਖ ਰਿਹਾ ਹਾਂ। ਮੈਂ ਇੱਕ ਵਾਕੰਸ਼ ਅਜ਼ਮਾਉਣ ਜਾ ਰਿਹਾ ਹਾਂ, ਤੁਸੀਂ ਜੋ ਸੁਣਿਆ ਉਹ ਇਮਾਨਦਾਰੀ ਨਾਲ ਦੱਸੋ।"},or:{temperature_inc:0,initial_prompt:"ମୁଁ ଓଡ଼ିଆ ଶିଖୁଛି। ମୁଁ ଗୋଟିଏ ଶବ୍ଦଗୁଚ୍ଛ ଚେଷ୍ଟା କରିବି, ଆପଣ ଯାହା ଶୁଣିଲେ ସତ୍ୟ ଭାବରେ କୁହନ୍ତୁ।"},as:{temperature_inc:0,initial_prompt:"মই অসমীয়া শিকি আছোঁ। মই এটা বাক্যাংশ চেষ্টা কৰিম, আপুনি যি শুনিলে সেইটো সত্যনিষ্ঠভাৱে কওক।"},ne:{temperature_inc:0,initial_prompt:"म नेपाली सिक्दैछु। म एउटा वाक्यांश प्रयास गर्ने छु, तपाईंले सुनेको कुरा इमानदारीपूर्वक भन्नुहोस्।"},si:{temperature_inc:0,initial_prompt:"මම සිංහල ඉගෙන ගන්නවා. මම වාක්‍ය ඛණ්ඩයක් උත්සාහ කරන්නම්, ඔබ ඇසූදේ අවංකව කියන්න."},fa:{temperature_inc:0,initial_prompt:"من فارسی یاد می‌گیرم. می‌خواهم یک عبارت بگویم، آنچه شنیدید را صادقانه بگویید."},ur:{temperature_inc:0,initial_prompt:"میں اردو سیکھ رہا ہوں۔ میں ایک جملہ بولنے جا رہا ہوں، جو آپ نے سنا اسے دیانتداری سے بتائیں۔"}},Vt="pc:whisper-tuning",qe=()=>{try{const e=localStorage.getItem(Vt);if(!e)return{};const t=JSON.parse(e);return!t||typeof t!="object"?{}:t}catch(e){return console.error("[whisperTuning] loadUserOverrides failed:",e),{}}},_t=e=>{try{localStorage.setItem(Vt,JSON.stringify(e))}catch(t){console.error("[whisperTuning] saveUserOverrides failed:",t)}},Rt=(e,t)=>{const r=qe(),n=e.split("-")[0].toLowerCase(),o={...r[n]??{},...t};for(const c of Object.keys(o))o[c]===void 0&&delete o[c];Object.keys(o).length===0?delete r[n]:r[n]=o,_t(r)},An=e=>{const t=qe(),r=e.split("-")[0].toLowerCase();delete t[r],_t(t)},Pn=()=>{_t({})},Xt=e=>{const t=e.split("-")[0].toLowerCase(),r=ut[t]??{},n=qe()[t]??{};return{...r,...n}},On={},Nn={},Bn="pc:scoring-tuning",Hn=()=>{try{const e=localStorage.getItem(Bn);if(!e)return{};const t=JSON.parse(e);return!t||typeof t!="object"?{}:t}catch(e){return console.error("[scoringTuning] loadUserScoringOverrides failed:",e),{}}},Jt=(e,t)=>{if(!t)return{};const r=t.toLowerCase();for(const[n,s]of Object.entries(e))if(r.includes(n.toLowerCase()))return s;return{}},Qt=(e,t)=>{var f,v;const r=e.split("-")[0].toLowerCase(),n=On[r]??{},s=Jt(Nn,t),o=Hn(),c=((f=o[r])==null?void 0:f.default)??{},p=Jt(((v=o[r])==null?void 0:v.byModel)??{},t);return{...n,...s,...c,...p}},mt=[{key:"temperature_inc",label:"temperature_inc",min:0,max:.5,step:.05,help:"Step for the fallback ladder (0.0 → 0.2 → 0.4 → … → 1.0). 0.0 disables retries entirely — one greedy decode, deterministic."},{key:"temperature",label:"temperature",min:0,max:1.5,step:.05,help:"Initial decoding temperature. 0.0 = greedy. Raise to sample from the start (almost never want for transcription)."},{key:"entropy_thold",label:"entropy_thold",min:0,max:10,step:.1,help:"Compression-ratio-style quality gate. Higher = more permissive. Indic BPE routinely exceeds 2.4 default."},{key:"logprob_thold",label:"logprob_thold",min:-5,max:0,step:.1,help:"Avg per-token log-prob below which the decode is flagged unconfident and the fallback fires."},{key:"no_speech_thold",label:"no_speech_thold",min:0,max:1,step:.05,help:"Whisper's posterior threshold for 'this segment is silence.' Above this, the segment emits nothing."},{key:"n_threads",label:"n_threads",min:0,max:12,step:1,help:"CPU thread count. 0 = let the plugin decide (cores − 2). Higher uses more battery; lower can free the UI thread."}],ft=[{key:"suppress_blank",label:"suppress_blank",help:"Suppress blank tokens at the start of a segment."},{key:"suppress_nst",label:"suppress_nst",help:"Suppress non-speech tokens (music, noise markers). False by default."}],ht=[{key:"initial_prompt",label:"initial_prompt",placeholder:"(empty)",help:"Up to ~224 tokens prepended before decoding. Bias toward a script/language; do NOT leak the expected phrase (model will parrot it). Native-script primer recommended for Indic langs."}],zn=e=>e.split("-")[0].toLowerCase(),Te=(e,t)=>t>=1?String(Math.round(e)):t>=.1?e.toFixed(1):e.toFixed(2),Ye=e=>e.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;");let de=null,he="";const Dn=e=>{var s,o,c,p,f;de&&Ke(),he=zn(e);const t=document.createElement("div");t.className="pc-tuner-root",t.innerHTML=Fn(he),document.body.appendChild(t),requestAnimationFrame(()=>{t.classList.add("open")}),(s=t.querySelector("[data-pc-tuner-backdrop]"))==null||s.addEventListener("click",Ke),(o=t.querySelector("[data-pc-tuner-close]"))==null||o.addEventListener("click",Ke);const r=t.querySelector("[data-pc-tuner-handle]"),n=t.querySelector(".pc-tuner-sheet");if(r&&n){let v=0,w=0,D=!1;const m=6;r.addEventListener("pointerdown",L=>{D=!0,v=L.clientY,w=Date.now(),r.setPointerCapture(L.pointerId),n.style.transition="none"}),r.addEventListener("pointermove",L=>{if(!D)return;const F=Math.max(0,L.clientY-v);n.style.transform=`translateY(${F}px)`});const y=(L,F)=>{if(!D)return;D=!1;try{r.releasePointerCapture(L.pointerId)}catch{}const b=L.clientY-v,_=Date.now()-w,Me=_>0?b/_:0,h=n.offsetHeight*.15,$=F&&(b>h||Me>.5&&b>20||Math.abs(b)<m);n.style.transition="",n.style.transform="",$&&Ke()};r.addEventListener("pointerup",L=>y(L,!0)),r.addEventListener("pointercancel",L=>y(L,!1))}t.addEventListener("keydown",v=>{v.key==="Escape"&&Ke()});for(const v of mt)Gn(t,v);for(const v of ft)Yn(t,v);for(const v of ht)Kn(t,v);(c=t.querySelector("[data-pc-tuner-copy]"))==null||c.addEventListener("click",Vn),(p=t.querySelector("[data-pc-tuner-reset-lang]"))==null||p.addEventListener("click",Xn),(f=t.querySelector("[data-pc-tuner-reset-all]"))==null||f.addEventListener("click",Jn),de=t},Ke=()=>{if(!de)return;const e=de;de=null,e.classList.remove("open"),window.setTimeout(()=>{e.parentNode&&e.parentNode.removeChild(e)},240)},Fn=e=>{const t=ut[e]??{},r=qe()[e]??{},n=mt.map(c=>Un(c,t,r)).join(""),s=ft.map(c=>Wn(c,t,r)).join(""),o=ht.map(c=>jn(c,t,r)).join("");return`
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
  `},Un=(e,t,r)=>{const n=Ne[e.key]??0,s=t[e.key],o=r[e.key],c=o!==void 0?o:s!==void 0?s:n,p=o!==void 0&&o!==n,f=[];return f.push(`<span>default <b>${Te(n,e.step)}</b></span>`),s!==void 0&&f.push(`<span>built-in <b>${Te(s,e.step)}</b></span>`),p&&f.push('<span class="pc-tuner-modified">modified</span>'),`
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
               value="${Te(c,e.step)}"
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
  `},Wn=(e,t,r)=>{const n=Ne[e.key],s=t[e.key],o=r[e.key],c=o!==void 0?o:s!==void 0?s:n,p=o!==void 0&&o!==n;return`
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
  `},jn=(e,t,r)=>{const n=t[e.key],s=r[e.key],o=s!==void 0?s:n!==void 0?n:"",c=s!==void 0&&s!==(n??""),p=[];return n&&n.length>0?p.push(`<span>built-in <b>"${Ye(n)}"</b></span>`):p.push("<span>default <b>(empty)</b></span>"),c&&p.push('<span class="pc-tuner-modified">modified</span>'),`
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
        ${p.join('<span class="pc-tuner-sep">·</span>')}
      </div>
      <p class="pc-tuner-help">${e.help}</p>
    </div>
  `},Gn=(e,t)=>{const r=e.querySelector(`[data-pc-tuner-slider="${t.key}"]`),n=e.querySelector(`[data-pc-tuner-num="${t.key}"]`);if(!r||!n)return;const s=o=>{const c=parseFloat(o);if(Number.isNaN(c))return;const p=Math.min(t.max,Math.max(t.min,c));Rt(he,{[t.key]:p}),r.value=String(p),n.value=Te(p,t.step),Be(e,t.key)};r.addEventListener("input",()=>{n.value=Te(parseFloat(r.value),t.step)}),r.addEventListener("change",()=>s(r.value)),n.addEventListener("change",()=>s(n.value))},Yn=(e,t)=>{const r=e.querySelector(`[data-pc-tuner-bool="${t.key}"]`);r&&r.addEventListener("change",()=>{Rt(he,{[t.key]:r.checked}),Be(e,t.key)})},Kn=(e,t)=>{const r=e.querySelector(`[data-pc-tuner-text="${t.key}"]`);if(!r)return;const n=()=>{const s=r.value;Rt(he,{[t.key]:s.length>0?s:void 0}),Be(e,t.key)};r.addEventListener("blur",n),r.addEventListener("keydown",s=>{s.key==="Enter"&&!(s.metaKey||s.ctrlKey||s.shiftKey)&&(s.preventDefault(),r.blur())})},Be=(e,t)=>{const r=ut[he]??{},n=qe()[he]??{},s=e.querySelector(`[data-pc-row="${t}"]`);if(!s)return;const o=s.querySelector(".pc-tuner-row-trail");if(!o)return;const c=mt.find(v=>v.key===t);if(c){const v=Ne[t]??0,w=r[t],D=n[t],m=D!==void 0&&D!==v,y=[`<span>default <b>${Te(v,c.step)}</b></span>`];w!==void 0&&y.push(`<span>built-in <b>${Te(w,c.step)}</b></span>`),m&&y.push('<span class="pc-tuner-modified">modified</span>'),o.innerHTML=y.join('<span class="pc-tuner-sep">·</span>');return}if(ft.find(v=>v.key===t)){const v=Ne[t],w=r[t],D=n[t],m=D!==void 0&&D!==v,y=[`<span>default <b>${v?"on":"off"}</b></span>`];w!==void 0&&y.push(`<span>built-in <b>${w?"on":"off"}</b></span>`),m&&y.push('<span class="pc-tuner-modified">modified</span>'),o.innerHTML=y.join('<span class="pc-tuner-sep">·</span>');return}if(ht.find(v=>v.key===t)){const v=r[t],w=n[t],D=w!==void 0&&w!==(v??""),m=[];v&&v.length>0?m.push(`<span>built-in <b>"${Ye(v)}"</b></span>`):m.push("<span>default <b>(empty)</b></span>"),D&&m.push('<span class="pc-tuner-modified">modified</span>'),o.innerHTML=m.join('<span class="pc-tuner-sep">·</span>')}},Vn=async()=>{var t;const e=JSON.stringify(qe(),null,2);try{await((t=navigator.clipboard)==null?void 0:t.writeText(e)),gt(`Copied (${e.length} chars)`)}catch(r){console.error("[whisperTunerUI] clipboard write failed:",r),gt("Copy failed — see console")}},Zt=e=>{const t=ut[he]??{},r=qe()[he]??{};for(const n of mt){const s=Ne[n.key]??0,o=r[n.key]!==void 0?r[n.key]:t[n.key]!==void 0?t[n.key]:s,c=e.querySelector(`[data-pc-tuner-slider="${n.key}"]`),p=e.querySelector(`[data-pc-tuner-num="${n.key}"]`);c&&(c.value=String(o)),p&&(p.value=Te(o,n.step)),Be(e,n.key)}for(const n of ft){const s=Ne[n.key],o=r[n.key]!==void 0?r[n.key]:t[n.key]!==void 0?t[n.key]:s,c=e.querySelector(`[data-pc-tuner-bool="${n.key}"]`);c&&(c.checked=o),Be(e,n.key)}for(const n of ht){const s=r[n.key]!==void 0?r[n.key]:t[n.key]!==void 0?t[n.key]:"",o=e.querySelector(`[data-pc-tuner-text="${n.key}"]`);o&&(o.value=s),Be(e,n.key)}},Xn=()=>{de&&(An(he),Zt(de),gt("Reset to built-in"))},Jn=()=>{de&&(Pn(),Zt(de),gt("All languages reset"))},gt=e=>{if(!de)return;const t=de.querySelector(".pc-tuner-foot");if(!t)return;const r=document.createElement("div");r.className="pc-tuner-flash",r.textContent=e,t.appendChild(r),window.setTimeout(()=>{r.parentNode&&r.parentNode.removeChild(r)},1600)};function en(){return typeof navigator>"u"?!0:navigator.onLine}function Qn(e){if(typeof window>"u")return()=>{};const t=()=>e(!0),r=()=>e(!1);return window.addEventListener("online",t),window.addEventListener("offline",r),()=>{window.removeEventListener("online",t),window.removeEventListener("offline",r)}}function Zn(){const e=document.createElementNS("http://www.w3.org/2000/svg","svg");e.setAttribute("viewBox","0 0 24 24"),e.setAttribute("class","corpan-offline-notice__icon"),e.setAttribute("aria-hidden","true");const t=document.createElementNS("http://www.w3.org/2000/svg","path");return t.setAttribute("d","M2 2l20 20M5.78 5.78A7 7 0 0 0 9 19h9.5a4.5 4.5 0 0 0 1.78-8.63 7 7 0 0 0-12.55-3.07"),t.setAttribute("stroke-linecap","round"),t.setAttribute("stroke-linejoin","round"),e.appendChild(t),e}function er(e){const t=e.density??"default",r=document.createElement("div");r.setAttribute("role","status"),r.setAttribute("aria-live","polite"),r.className=`corpan-offline-notice corpan-offline-notice--${t}`,r.appendChild(Zn());const n=document.createElement("p");if(n.className="corpan-offline-notice__title",n.textContent=e.title,r.appendChild(n),e.subtitle&&t!=="compact"){const s=document.createElement("p");s.className="corpan-offline-notice__subtitle",s.textContent=e.subtitle,r.appendChild(s)}if(e.action&&t!=="compact"){const s=document.createElement("div");s.className="corpan-offline-notice__action",s.appendChild(e.action),r.appendChild(s)}return{element:r,setTitle:s=>{n.textContent=s},remove:()=>{r.remove()}}}const Ve=e=>{if(e&&typeof e=="object"){const t=e.code;if(typeof t=="string")return t}},ge=e=>{if(e==null)return"(unknown error)";if(typeof e=="string")return e;if(e instanceof Error)return e.message||e.name||String(e);if(typeof e=="object"){const t=e,r=[t.message,t.localizedDescription,t.error,t.description,t.detail];for(const n of r)if(typeof n=="string"&&n.length>0)return n;try{const n=JSON.stringify(e);if(n&&n!=="{}")return n}catch{}}return String(e)},tr=70,nr=.4,It="corpan-pronunciation-coach:v2",tn="corpan-pronunciation-coach:v1",rr=50,ve=e=>{var t;return((t=fe(e))==null?void 0:t.folder)??e},Q=e=>{var t;return((t=fe(e))==null?void 0:t.label)??e},ar=e=>{const t=fe(e);return t&&t.approxSizeMB>=1e3?18e4:6e4},or=9e4,nn=async(e,t,r)=>{let n=null;const s=new Promise((o,c)=>{n=setTimeout(()=>{c(new Error(`${r} timed out after ${Math.round(t/1e3)}s`))},t)});try{return await Promise.race([e,s])}finally{n&&clearTimeout(n)}},sr=e=>{var t,r,n;return{entryId:e.entry.entry_id,level:e.entry.level,domains:e.entry.domains??[],targetLang:e.targetLang,targetText:e.target.text,targetRoman:e.target.romanization??"",nativeLang:((t=e.native)==null?void 0:t.language_code)??null,nativeText:((r=e.native)==null?void 0:r.text)??"",nativeRoman:((n=e.native)==null?void 0:n.romanization)??""}},ir=e=>({entry:{entry_id:e.entryId,level:e.level,domains:e.domains,translations:[]},target:{language_code:e.targetLang,text:e.targetText,romanization:e.targetRoman},native:e.nativeLang?{language_code:e.nativeLang,text:e.nativeText,romanization:e.nativeRoman}:null,targetLang:e.targetLang}),rn=/[''']/,cr={en:{zero:"0",one:"1",two:"2",three:"3",four:"4",five:"5",six:"6",seven:"7",eight:"8",nine:"9",ten:"10",eleven:"11",twelve:"12",thirteen:"13",fourteen:"14",fifteen:"15",sixteen:"16",seventeen:"17",eighteen:"18",nineteen:"19",twenty:"20",thirty:"30",forty:"40",fifty:"50",sixty:"60",seventy:"70",eighty:"80",ninety:"90",hundred:"100",thousand:"1000"},es:{cero:"0",uno:"1",una:"1",dos:"2",tres:"3",cuatro:"4",cinco:"5",seis:"6",siete:"7",ocho:"8",nueve:"9",diez:"10",once:"11",doce:"12",trece:"13",catorce:"14",quince:"15",dieciséis:"16",dieciseis:"16",diecisiete:"17",dieciocho:"18",diecinueve:"19",veinte:"20",treinta:"30",cuarenta:"40",cincuenta:"50",sesenta:"60",setenta:"70",ochenta:"80",noventa:"90",cien:"100",ciento:"100",mil:"1000"},fr:{zéro:"0",zero:"0",un:"1",une:"1",deux:"2",trois:"3",quatre:"4",cinq:"5",six:"6",sept:"7",huit:"8",neuf:"9",dix:"10",onze:"11",douze:"12",treize:"13",quatorze:"14",quinze:"15",seize:"16",vingt:"20",trente:"30",quarante:"40",cinquante:"50",soixante:"60",cent:"100",mille:"1000"},it:{zero:"0",uno:"1",una:"1",due:"2",tre:"3",quattro:"4",cinque:"5",sei:"6",sette:"7",otto:"8",nove:"9",dieci:"10",undici:"11",dodici:"12",tredici:"13",quattordici:"14",quindici:"15",sedici:"16",diciassette:"17",diciotto:"18",diciannove:"19",venti:"20",trenta:"30",quaranta:"40",cinquanta:"50",sessanta:"60",settanta:"70",ottanta:"80",novanta:"90",cento:"100",mille:"1000"},de:{null:"0",eins:"1",ein:"1",eine:"1",zwei:"2",drei:"3",vier:"4",fünf:"5",funf:"5",sechs:"6",sieben:"7",acht:"8",neun:"9",zehn:"10",elf:"11",zwölf:"12",zwolf:"12",dreizehn:"13",vierzehn:"14",fünfzehn:"15",funfzehn:"15",sechzehn:"16",siebzehn:"17",achtzehn:"18",neunzehn:"19",zwanzig:"20",dreißig:"30",dreissig:"30",vierzig:"40",fünfzig:"50",funfzig:"50",sechzig:"60",siebzig:"70",achtzig:"80",neunzig:"90",hundert:"100",tausend:"1000"},pt:{zero:"0",um:"1",uma:"1",dois:"2",duas:"2",três:"3",tres:"3",quatro:"4",cinco:"5",seis:"6",sete:"7",oito:"8",nove:"9",dez:"10",onze:"11",doze:"12",treze:"13",catorze:"14",quatorze:"14",quinze:"15",dezesseis:"16",dezasseis:"16",dezessete:"17",dezassete:"17",dezoito:"18",dezenove:"19",dezanove:"19",vinte:"20",trinta:"30",quarenta:"40",cinquenta:"50",sessenta:"60",setenta:"70",oitenta:"80",noventa:"90",cem:"100",cento:"100",mil:"1000"}},lr=new Set(["te","ta","bn","ml","mr","gu","pa","ur","fa","si","ne","or","as"]),dr=new Set(["ar","he","fa","ur"]),pr=new Set(["pa-arab"]),an=e=>{if(!e)return!1;const t=e.toLowerCase();return pr.has(t)?!0:dr.has(t.split("-")[0])},Ee=(e,t)=>{const r=e.normalize("NFC").toLowerCase().replace(/[\p{P}\p{S}\p{C}]/gu,"").replace(/\s+/g," ").trim();if(!r)return r;const n=(t??"").toLowerCase().split("-")[0],s=cr[n];return s?r.split(" ").map(o=>s[o]??o).join(" "):r},ur=/[぀-ゟ゠-ヿ㐀-䶿一-鿿豈-﫿가-힯]/,vt=e=>{const t=e.trim();if(!t)return[];if(/\s/.test(t))return t.split(/\s+/).filter(Boolean);if(ur.test(t)){const r=Intl.Segmenter;if(typeof r=="function"){const n=new r(void 0,{granularity:"grapheme"});return Array.from(n.segment(t),s=>s.segment).filter(s=>s.trim().length>0)}return Array.from(t).filter(n=>n.trim().length>0)}return[t]},yt=(e,t)=>{const r=Array.from(e),n=Array.from(t),s=r.length,o=n.length;if(s===0&&o===0)return 1;if(s===0||o===0)return 0;let c=new Array(o+1),p=new Array(o+1);for(let f=0;f<=o;f++)c[f]=f;for(let f=1;f<=s;f++){p[0]=f;for(let w=1;w<=o;w++)p[w]=r[f-1]===n[w-1]?c[w-1]:1+Math.min(c[w],p[w-1],c[w-1]);const v=c;c=p,p=v}return 1-c[o]/Math.max(s,o)},on=e=>{if(!e||e.length===0)return[];const t=[];for(const r of e){const n=t[t.length-1];if(n){const s=n.word.replace(/\s+$/,"").slice(-1),o=r.word.replace(/^\s+/,"").charAt(0),c=rn.test(s),p=rn.test(o);if(c||p){n.word=n.word+r.word.replace(/^\s+/,""),n.endMs=Math.max(n.endMs,r.endMs),n.probability=Math.min(n.probability,r.probability);continue}}t.push({...r})}return t},mr=()=>{try{const e=window.localStorage,t="__pc_probe__";return e.setItem(t,"1"),e.removeItem(t),e}catch{return null}},sn=e=>{if(!e)return null;try{const t=JSON.parse(e);return typeof t!="object"||t===null||!Array.isArray(t.phrases)||typeof t.idx!="number"||typeof t.streak!="number"?null:t}catch(t){return console.error("[pronunciation-coach] localStorage parse failed:",t),null}},cn=e=>{if(!e)return null;const t=sn(e.getItem(It));if(t)return t;const r=sn(e.getItem(tn));if(!r)return null;const n={...r,mode:r.mode==="standard"?"standard":void 0};try{e.setItem(It,JSON.stringify(n)),e.removeItem(tn),console.log("[pronunciation-coach] migrated v1 → v2 storage, mode preserved:",n.mode??"(cleared)")}catch(s){console.error("[pronunciation-coach] storage migration failed:",s)}return n},fr=()=>{try{const e=globalThis.crypto;if(e&&typeof e.randomUUID=="function")return e.randomUUID()}catch(e){console.error("[pronunciation-coach] randomUUID failed:",e)}return`pc-${Date.now()}-${Math.floor(Math.random()*1e9)}`},ln=e=>e?e.split("-")[0].toLowerCase():"en",hr=e=>{const t=[...e];for(let r=t.length-1;r>0;r--){const n=Math.floor(Math.random()*(r+1));[t[r],t[n]]=[t[n],t[r]]}return t},gr=(e,t)=>{if(t.length<=1){const o=t[0];return{target:o?e.translations.find(p=>p.language_code===o)??null:null,native:null}}const r=t.length>0?e.translations.find(o=>o.language_code===t[0])??null:null;let n=null;const s=hr(t.slice(1));for(const o of s){const c=e.translations.find(p=>p.language_code===o);if(c){n=c;break}}return n||(n=e.translations.find(o=>!r||o.language_code!==r.language_code)??null),{target:n,native:r}},Z=e=>e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"),bt=()=>{try{window.dispatchEvent(new CustomEvent("corpan:exit"))}catch(e){console.error("[pronunciation-coach] dispatch exit failed:",e)}},vr=e=>{const t=document.createElement("div");t.className="pc-confetti";const r=["#7c3aed","#16a34a","#facc15","#ec4899","#06b6d4"],n=32;for(let s=0;s<n;s++){const o=document.createElement("span");o.style.left=`${Math.random()*100}%`,o.style.background=r[s%r.length],o.style.animationDelay=`${Math.random()*200}ms`,o.style.animationDuration=`${900+Math.random()*600}ms`,o.style.transform=`rotate(${Math.random()*360}deg)`,t.appendChild(o)}e.appendChild(t),window.setTimeout(()=>t.remove(),1800)},yr=(e,t,r)=>{const n=t.stt;let s=!1,o=null;const c=document.querySelector('meta[name="viewport"]'),p=(c==null?void 0:c.getAttribute("content"))??null;c&&c.setAttribute("content","width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover");const f=()=>{c&&p!==null&&c.setAttribute("content",p)},v=(a="Speech recognition isn't available on this device",i="Parlometron needs the on-device Whisper plugin and didn't find a working one here. Try updating the app, or this platform may not be supported yet.")=>{var l;e.innerHTML=`
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
  `;const w=e.querySelector("#pc-close"),D=e.querySelector("#pc-streak"),m=e.querySelector("#pc-streak-n"),y=e.querySelector("#pc-mode"),L=e.querySelector("#pc-swipe-area"),F=e.querySelector("#pc-deck");let b=e.querySelector("#pc-card");const _=e.querySelector("#pc-mic"),Me=e.querySelector("#pc-mic-icon"),h=e.querySelector("#pc-mic-label"),$=a=>a.querySelector("[data-pc-result-banner]"),M=a=>a.querySelector("[data-pc-result-transcript-up]"),B=a=>a.querySelector("[data-pc-result-bars-up]"),ae=a=>a.querySelector("[data-pc-result-detail]"),z=e.querySelector("#pc-error");let P=null;const K=(a,i)=>{P||(P=document.createElement("div"),P.className="pc-overlay",P.innerHTML=`
        <div class="pc-spinner"></div>
        <div id="pc-overlay-msg"></div>
        <button id="pc-overlay-cancel" type="button" hidden></button>`,document.body.appendChild(P));const l=P.querySelector("#pc-overlay-msg");l&&(l.textContent=a);const d=P.querySelector("#pc-overlay-cancel");d&&(i!=null&&i.cancelLabel&&i.onCancel?(d.textContent=i.cancelLabel,d.hidden=!1,d.onclick=i.onCancel):(d.hidden=!0,d.onclick=null))},Y=()=>{P&&P.parentNode&&P.parentNode.removeChild(P),P=null},x=a=>{z.textContent=a,z.hidden=!1,console.error("[pronunciation-coach]",a)},ye=()=>{z.textContent="",z.hidden=!0};let ne="idle",q=!1,k=null;const V=[];let W=-1,be=null,ce=0,E=Kt().id,oe=!1;const pe=mr(),xe=()=>{if(pe)try{const a=Math.max(0,V.length-rr),i=V.slice(a).map(sr),l=W-a,d={streak:ce,phrases:i,idx:l,mode:E};pe.setItem(It,JSON.stringify(d))}catch(a){console.error("[pronunciation-coach] persist failed:",a)}},He=()=>{const a=fe(E);y.setAttribute("aria-pressed",E==="advanced"?"true":"false"),y.classList.toggle("advanced",E==="advanced"),y.disabled=oe;const i=a?`${a.label} model (~${a.approxSizeMB} MB) · tap to switch`:`${Q(E)} model · tap to switch`;y.title=i,y.setAttribute("aria-label",`Speech model: ${Q(E)}`);const l=e.querySelector("#pc-footer-model");l&&(l.textContent=Q(E))},Ze=()=>{ce<=0?D.hidden=!0:(m.textContent=String(ce),D.hidden=!1)},ee=a=>{ne=a,_.classList.remove("recording","scoring"),_.disabled=!1,a==="idle"?(Me.innerHTML="●",h.textContent=q?"Tap to speak":"Loading model…",_.disabled=!q||!k):a==="recording"?(_.classList.add("recording"),Me.innerHTML="■",h.textContent="Listening… tap to stop"):a==="scoring"&&(_.classList.add("scoring"),Me.innerHTML='<div class="pc-spinner"></div>',h.textContent="Scoring…",_.disabled=!0)},ze=(a,i,l)=>`
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
  `,Le=e.querySelector("#pc-lang-badge"),et=a=>{if(!a){Le.hidden=!0,Le.textContent="—",Le.setAttribute("data-pc-lang","");return}const i=ln(a);Le.hidden=!1,Le.textContent=i.toUpperCase(),Le.setAttribute("data-pc-lang",i),Le.setAttribute("aria-label",`Target language ${i.toUpperCase()} — long-press to tune Whisper`)},O=(a,i)=>{var T;const d=!!t.getStackConfig().showRomanization,g=i.target.romanization||"",R=d&&g?`<p class="pc-romanization">${Z(g)}</p>`:"",N=(T=i.native)!=null&&T.text?`<p class="pc-native">${Z(i.native.text)}</p>`:"";a.innerHTML=ze(`<h1 class="pc-target">${Z(i.target.text||"—")}</h1>`,R,N),et(i.targetLang)},G=(a,i,l)=>{a.innerHTML=ze(`<h1 class="pc-target">${Z(i)}</h1>`,"",`<p class="pc-native">${Z(l)}</p>`),et(null)},se=()=>{k&&O(b,k)},De=async(a,i)=>{const l=F.clientWidth||window.innerWidth,d=a==="left"?-1:1;b.style.transition="transform 220ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 200ms ease",b.style.transform=`translateX(${d*l}px)`,b.style.opacity="0",await new Promise(R=>window.setTimeout(R,220));const g=document.createElement("div");g.className="pc-card entering",g.id="pc-card",g.style.transition="none",g.style.transform=`translateX(${-d*l}px)`,g.style.opacity="0",i(g),F.replaceChild(g,b),b=g,b.offsetWidth,b.style.transition="transform 280ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 240ms ease",b.style.transform="translateX(0)",b.style.opacity="1",b.classList.remove("entering"),b.classList.add("entered")},Fe=async()=>{const a=t.getStackConfig();if(!a.languages||a.languages.length<1||!t.getRandomEntry)return null;const i=await t.getRandomEntry(),{target:l,native:d}=gr(i,a.languages);return l?{entry:i,target:l,native:d,targetLang:l.language_code}:null},Se=()=>{be||s||Fe().then(a=>{!s&&a&&(be=a)}).catch(a=>{console.error("[pronunciation-coach] prefetch failed:",a)})},St=async()=>{if(ne==="scoring")return;tt(),ye();const a=t.getStackConfig();if(!a.languages||a.languages.length<1){k=null,G(b,"No language selected","Open Corpán settings and choose a language to practise."),_.disabled=!0,h.textContent="—";return}if(W>=0&&W<V.length-1){const l=V[W+1];W+=1,await De("left",d=>O(d,l)),k=l,ee("idle"),xe();return}let i=be;if(be=null,!i)try{i=await Fe()}catch(l){console.error("[pronunciation-coach] fetch next failed:",l),x(`Could not load a phrase: ${ge(l)}`);return}if(!i){x("No phrases available — check your stack config.");return}V.push(i),W=V.length-1,await De("left",l=>O(l,i)),k=i,ee("idle"),xe(),Se()},hn=async()=>{if(ne==="scoring"||W<=0)return;tt(),ye();const a=V[W-1];W-=1,await De("right",i=>O(i,a)),k=a,ee("idle"),xe()},Xr=a=>{const i=$(a),l=M(a),d=B(a),g=ae(a),R=()=>{i&&(i.innerHTML="",i.hidden=!0,i.className="pc-result-banner"),l&&(l.innerHTML="",l.hidden=!0,l.className="pc-result-transcript-up"),d&&(d.innerHTML="",d.hidden=!0,d.className="pc-result-bars-up"),g&&(g.innerHTML="",g.hidden=!0,g.className="pc-result-detail")};if(!(i&&!i.hidden||l&&!l.hidden||d&&!d.hidden||g&&!g.hidden)){R();return}i&&!i.hidden&&i.classList.add("leaving"),l&&!l.hidden&&l.classList.add("leaving"),d&&!d.hidden&&d.classList.add("leaving"),g&&!g.hidden&&g.classList.add("leaving"),window.setTimeout(R,220)},Jr=()=>Xr(b),Qr=a=>{const i=Math.max(0,Math.min(1,a.overallScore)),l=Math.max(0,Math.min(1,a.noSpeechProb??0)),d=a.compressionRatio??0;console.info("[PRON:score]",{lang:a.whisperLanguage||a.language,model:ve(E),expected:(k==null?void 0:k.target.text)??"",heard:a.text,free:a.freeText,overall:a.overallScore,transcript:a.transcriptScore,acoustic:a.acousticScore,likelihood:a.likelihoodScore,noSpeechProb:a.noSpeechProb,compressionRatio:a.compressionRatio,avgLogprob:a.avgLogprob,minTokenLogprob:a.minTokenLogprob,tokenLogprobStdev:a.tokenLogprobStdev,temperature:a.temperature});const g=Math.max(0,Math.min(1,a.freeVsConstrainedSimilarity??1)),R=A=>`${Math.round(A*100)}%`,N=l>.5;let T="bad",H="Try again";N?(T="bad",H="🎙️ Couldn't hear you"):i>=.95?(T="good",H="✨ Perfect!"):i>=.85?(T="good",H="🎉 Nailed it!"):i>=.75?(T="good",H="Great"):i>=.6?(T="okay",H="Pretty good"):i>=.45?(T="okay",H="Close — keep going"):i>=.25&&(T="bad",H="Keep practicing"),N||(i>=.85?(ce+=1,vr(document.body)):i>=.6||(ce=0)),Ze(),xe();const U=on(a.words||[]),S=((k==null?void 0:k.target.text)||"").trim(),j=vt(S),ue=(a.freeText||"").trim(),we=vt(ue),st=j.length>0&&j.length===U.length,$e=j.length>0&&j.length===we.length,it=S.length>0&&ue.length===0,Ce=(k==null?void 0:k.targetLang)||a.language||"",Et=ue.length&&S.length?yt(Ee(ue,Ce),Ee(S,Ce)):it?0:null,ct=j.length?j.map((A,J)=>({word:A,heardProb:st?U[J].probability:null,freeSim:$e?yt(Ee(A,Ce),Ee(we[J],Ce)):Et})):S?[{word:S,heardProb:null,freeSim:Et}]:[],lt=A=>A===null?null:A>=.9?"good":A>=.6?"okay":"bad",u=A=>A===null?null:A>=.85?"good":A>=.6?"okay":"bad",I={bad:0,okay:1,good:2},X=A=>{const J=lt(A.heardProb),ie=u(A.freeSim);return J===null&&ie===null?"":J===null?ie:ie===null||I[J]<=I[ie]?J:ie},C=ct.map((A,J)=>`<button class="pc-word ${X(A)}" type="button" data-pc-word-idx="${J}" aria-label="Speak ${Z(A.word)}">${Z(A.word)}</button>`).join(""),te=an(Ce),re=te?"pc-transcript-line pc-transcript-line-rtl":"pc-transcript-line",le=te?"◀":"▶",_e=ue.length?`<div class="pc-transcript-row heard" role="button" tabindex="0"
             data-pc-speak="heard" data-no-swipe
             aria-label="Play what Whisper heard">
           <span class="pc-transcript-label">Heard you say</span>
           <span class="${re}">
             <span class="pc-transcript-play" aria-hidden="true">${le}</span>
             <span class="pc-transcript-text">${Z(ue)}</span>
           </span>
         </div>`:it?`<div class="pc-transcript-row heard empty">
             <span class="pc-transcript-label">Heard you say</span>
             <span class="pc-transcript-line">
               <span class="pc-transcript-text empty">(couldn't make out the words)</span>
             </span>
           </div>`:"",Pe=_e?`<div class="pc-transcripts">${_e}</div>`:"",Mt={"pa-arab":"Different writing system — scoring may be off","yue-hant-hk":"Different writing system — scoring may be off","zh-hans":"Different writing system — scoring may be off","zh-hant":"Different writing system — scoring may be off"},Ut=(a.language??"").toLowerCase(),xt=Mt[Ut],ke=[];l>.2&&ke.push('<div class="pc-chip pc-chip-warn">Sounded faint — try a bit louder</div>');const Wt=Ce.toLowerCase().split("-")[0],Re=lr.has(Wt)?3.5:2.4;d>Re&&ke.push('<div class="pc-chip pc-chip-warn">Sounded a bit garbled</div>'),it?ke.push(`<div class="pc-chip pc-chip-warn">Couldn't make out the words</div>`):g<.6&&ke.push(`<div class="pc-chip pc-chip-warn">Words didn't quite match</div>`),xt&&ke.push(`<div class="pc-chip">${Z(xt)}</div>`);const ia=ke.length?`<div class="pc-chips pc-diagnostics">${ke.join("")}</div>`:"",Oe=$(b),jt=M(b),Gt=B(b),Ge=ae(b);if(!Oe||!Ge){console.error("[pronunciation-coach] renderResult: card missing result slots");return}if(N)Oe.className=`pc-result-banner ${T}`,Oe.innerHTML=`
        <span class="pc-result-banner-score">—</span>
        <span class="pc-result-banner-sep">·</span>
        <span class="pc-result-banner-text">${H}</span>
      `,Oe.hidden=!1,Ge.innerHTML=`
        <div class="pc-chips">
          <div class="pc-chip">Move the device closer or speak louder.</div>
        </div>
      `,Ge.hidden=!1;else{Oe.className=`pc-result-banner ${T}`,Oe.innerHTML=`
        <span class="pc-result-banner-score">${R(i)}</span>
        <span class="pc-result-banner-sep">·</span>
        <span class="pc-result-banner-text">${H}</span>
      `,Oe.hidden=!1,jt&&(jt.innerHTML=Pe,jt.hidden=!Pe),Gt&&(Gt.innerHTML="",Gt.hidden=!0);const A=te?"pc-words pc-words-rtl":"pc-words";Ge.innerHTML=`
        ${C?`<div class="${A}">${C}</div>`:""}
        ${ia}
      `,Ge.hidden=!1}const Mn=(A,J)=>{const ie=(k==null?void 0:k.targetLang)||a.language||"en";try{const me=t.speak(ie,A);me&&typeof me.catch=="function"&&me.catch(ca=>{console.error(`[pronunciation-coach] ${J} speak failed:`,ca)})}catch(me){console.error(`[pronunciation-coach] ${J} speak threw:`,me)}};Ge.querySelectorAll("button.pc-word[data-pc-word-idx]").forEach(A=>{A.addEventListener("click",()=>{const J=A.getAttribute("data-pc-word-idx");if(J===null)return;const ie=Number(J),me=ct[ie];me&&Mn(me.word.trim(),"word")})}),b.querySelectorAll(".pc-transcript-row[data-pc-speak]").forEach(A=>{const J=()=>{ue&&Mn(ue,"heard")};A.addEventListener("click",J),A.addEventListener("keydown",ie=>{const me=ie.key;(me==="Enter"||me===" ")&&(ie.preventDefault(),J())})})},tt=()=>{const a=o;o=null,a&&n.cancelSession({sessionId:a}).catch(i=>{console.error("[pronunciation-coach] cancelSession failed:",i)})},gn=async()=>{if(!k||!q)return;ye(),Jr();const a=fr();o=a;try{ee("recording");const i=ln(k.targetLang),l=await n.startSession({sessionId:a,language:i,expectedText:k.target.text,whisperParams:Xt(i),scoringParams:Qt(i,ve(E))});if(s)return;if(!l.started)throw new Error("STT plugin reported started=false")}catch(i){console.error("[pronunciation-coach] startSession failed:",i),o=null,x(`Could not start recording: ${ge(i)}`),ee("idle")}},Nt=async a=>{if(!n)throw new Error("STT unavailable");const i=ve(a),l=await nn(n.prepare({model:i}),ar(a),`Loading ${Q(a)} model`);if(!l.ready){const d=new Error(l.message||"Model not ready");throw d.code=l.code,d}return l};class vn extends Error{constructor(){super("Switch cancelled by user"),this.name="SwitchCancelledError"}}const yn=1500,Bt=10,Zr=async a=>{const i=Q(a);let l=null,d=!1;const g=()=>{d=!0};for(let R=1;R<=Bt;R++){if(d)throw new vn;try{return await Nt(a)}catch(N){if(Ve(N)!=="INSUFFICIENT_MEMORY")throw N;if(l=N,R===Bt)break;const H=Bt-R;K(`Freeing memory for ${i}…
This usually takes a few seconds.`,{cancelLabel:"Cancel",onCancel:g}),console.log(`[pronunciation-coach] INSUFFICIENT_MEMORY on attempt ${R}; waiting ${yn}ms, ${H} retries left`),await new Promise(U=>setTimeout(U,yn))}}throw l??new Error("INSUFFICIENT_MEMORY")},bn=async()=>{const a=o;if(!a){ee("idle");return}o=null;try{ee("scoring");const i=await nn(n.stopSession({sessionId:a}),or,"Scoring");if(s)return;Qr(i),ee("idle")}catch(i){const l=ge(i),d=Ve(i);if(console.error(`[pronunciation-coach] stopSession failed (code=${d??"—"}):`,l),ee("idle"),d==="LOAD_FAILED"){q=!1,_.disabled=!0,h.textContent="Model needs reinstall",x(`${Q(E)} model failed to load — opening setup so you can reinstall.`),Ht().catch(g=>{console.error("[pronunciation-coach] openModelSetup after LOAD_FAILED:",g)});return}if(d==="NETWORK"){x("Brief network blip while scoring. Try again — your model is fine.");return}x(`Scoring failed: ${l}`)}};_.addEventListener("click",()=>{ne==="idle"?gn().catch(a=>{console.error("[pronunciation-coach] startRecording threw:",a)}):ne==="recording"&&bn().catch(a=>{console.error("[pronunciation-coach] stopRecording threw:",a)})}),w.addEventListener("click",()=>{tt(),r!=null&&r.onClose?r.onClose():bt()});const wn=async a=>{if(!(n!=null&&n.prepare))return!1;try{const i=await n.prepare({model:ve(a)});return i.ready?!0:(console.error(`[pronunciation-coach] ensureLoaded(${a}) failed: code=${i.code??"—"} msg=${i.message??""}`),!1)}catch(i){return console.error(`[pronunciation-coach] ensureLoaded(${a}) threw:`,i),!1}},Ht=async()=>{if(oe)return;oe=!0,tt(),ee("idle");const a=E,i=q?E:null;console.log(`[pronunciation-coach] openModelSetup: modelMode=${E} modelReady=${q} activeForOverlay=${i??"null"}`);let l;try{l=await sa({currentActive:i,headline:"Parlometron · Models",sub:"These are large, experimental, cutting-edge AI speech models running entirely on your device — no servers, no internet, no privacy compromises. They are also, frankly, not as reliable as you might hope. The bigger ones might crash your phone. The smaller ones might transcribe 'good morning' as 'goldfish moon'. Any of them might surprise you in either direction. Welcome to on-device AI in 2026. Don't take the scoring too seriously. 🤷"})}finally{oe=!1,He()}if(s)return;if(l.kind==="exit"){!q&&a&&await wn(a)&&(q=!0);return}if(l.kind==="cancelled"){ee("idle"),!q&&a&&await wn(a)&&(q=!0);return}if(l.mode===a&&q){ee("idle");return}const d=l.mode,g=Q(d),R=fe(d),N=(R==null?void 0:R.approxSizeMB)??0;if(N>0&&(n!=null&&n.getStatus))try{const H=(await n.getStatus()).availableMemoryMB??null;if(H!==null&&H<N*.5){console.warn(`[pronunciation-coach] pre-flight refused switch to ${d}: avail=${H}MB target=${N}MB`),ee("idle"),x(`Not enough memory to switch to ${g} right now (${H} MB free, need ~${Math.round(N*1.3)} MB). Close other apps and restart Corpán, then try again. Your current model is still loaded.`);return}}catch(T){console.warn("[pronunciation-coach] pre-flight status check failed; deferring to native gate:",T)}if(q=!1,_.disabled=!0,n!=null&&n.unload&&a&&a!==d){h.textContent=`Unloading ${Q(a)}…`,K(`Unloading ${Q(a)} model to free memory…`);try{await n.unload()}catch(T){console.warn("[pronunciation-coach] explicit unload before switch failed:",T)}}h.textContent=`Loading ${g} model…`,K(`Loading ${g} model…
This can take 10–30s on first launch.`);try{const T=await Zr(d);q=!0,E=d,xe(),He(),console.log(`[pronunciation-coach] WhisperKit prepared: ${T.model} (${g})`),Y(),_.disabled=!1,ee("idle")}catch(T){const H=ge(T),U=Ve(T),S=T instanceof vn;if(console.error(`[pronunciation-coach] post-setup load ${S?"cancelled":"failed"} (code=${U??"—"}):`,S?"user cancel":H),a&&a!==d)try{const j=await Nt(a);q=!0,E=a,He(),Y(),_.disabled=!1,ee("idle"),x(S?`Switch to ${g} cancelled. Staying on ${Q(a)}.`:U==="MODEL_NOT_INSTALLED"?`${g} isn't installed yet. Staying on ${Q(a)}.`:U==="NETWORK"?`${g} needs internet to finish setting up. Reconnect and try again — staying on ${Q(a)} for now.`:U==="INSUFFICIENT_MEMORY"?`Not enough memory to load ${g}. Close other apps and restart Corpán, then try the switch again. Reverted to ${Q(a)}.`:`Couldn't switch to ${g}: ${H}. Staying on ${Q(a)}.`),console.log(`[pronunciation-coach] reverted to ${j.model} (${Q(a)}) after switch failure`);return}catch(j){console.error("[pronunciation-coach] revert to previous model also failed:",j)}Y(),x(S?`Switch to ${g} cancelled.`:U==="STT_UNAVAILABLE"?"Parlometron needs on-device speech recognition that isn't available on this device. It works on iPhone, iPad, and most Android phones — Chromebooks running Android in ARC aren't supported yet.":U==="MODEL_NOT_INSTALLED"?`${g} model isn't fully installed (likely a partial download). Tap the model badge to reinstall.`:U==="NETWORK"?`${g} needs internet to finish setting up. Reconnect and try again.`:U==="INSUFFICIENT_MEMORY"?`Not enough memory to load ${g}. Close other apps and restart Corpán, then try again.`:`Could not load ${g} model: ${H}`),h.textContent="Model unavailable"}};y.addEventListener("click",()=>{Ht().catch(a=>{console.error("[pronunciation-coach] openModelSetup threw:",a)})});let $t=!1,zt=0,Ln=0,Sn=0,kt=0,Dt=0,nt=!1,Ft=!1,rt=null,Tt=!1;const ea=()=>{if(k)try{const a=t.speak(k.targetLang,k.target.text);a&&typeof a.catch=="function"&&a.catch(i=>{console.error("[pronunciation-coach] speak phrase failed:",i)})}catch(a){console.error("[pronunciation-coach] speak phrase threw:",a)}},ta=a=>!a||!(a instanceof Element)?!1:!!a.closest("button, input, textarea, select, a, [data-no-swipe]"),Ue=L;Ue.addEventListener("pointerdown",a=>{ne!=="scoring"&&(ta(a.target)||a.pointerType==="mouse"&&a.button!==0||($t=!0,zt=a.clientX,Ln=a.clientY,kt=a.clientX,Dt=a.clientY,Sn=performance.now(),nt=!1,Ft=!1,rt=null,b.classList.add("dragging")))},{passive:!0}),Ue.addEventListener("pointermove",a=>{if(!$t)return;kt=a.clientX,Dt=a.clientY;const i=kt-zt,l=Dt-Ln;if(!nt&&!Ft)if(Math.abs(i)>12&&Math.abs(i)>Math.abs(l)*1.2){nt=!0;try{Ue.setPointerCapture(a.pointerId),rt=a.pointerId}catch{}}else Math.abs(l)>12&&(Ft=!0);if(nt){const d=i*.9;b.style.transition="none",b.style.transform=`translateX(${d}px) rotate(${d*.01}deg)`,b.style.opacity=String(Math.max(.4,1-Math.abs(i)/400))}},{passive:!0});const $n=()=>{if(!$t)return;if($t=!1,b.classList.remove("dragging"),rt!==null){try{Ue.releasePointerCapture(rt)}catch{}rt=null}if(!nt){b.style.transition="transform 200ms ease, opacity 200ms ease",b.style.transform="",b.style.opacity="";return}const a=kt-zt,i=Math.max(1,performance.now()-Sn),l=Math.abs(a)/i,d=Math.abs(a)>=tr,g=l>=nr;d||g?(Tt=!0,window.setTimeout(()=>{Tt=!1},500),a<0?St().catch(R=>console.error("[pronunciation-coach] swipe-next failed:",R)):W>0?hn().catch(R=>console.error("[pronunciation-coach] swipe-prev failed:",R)):(b.style.transition="transform 220ms ease, opacity 220ms ease",b.style.transform="",b.style.opacity="")):(b.style.transition="transform 220ms ease, opacity 220ms ease",b.style.transform="",b.style.opacity="")};Ue.addEventListener("pointerup",$n,{passive:!0}),Ue.addEventListener("pointercancel",$n,{passive:!0}),F.addEventListener("click",a=>{if(Tt){Tt=!1;return}const i=a.target;i&&(i.closest("button, input, a")||i.closest(".pc-target, .pc-romanization")&&ea())});const kn=a=>{a.key==="ArrowLeft"?hn().catch(i=>console.error("[pronunciation-coach] arrow-left failed:",i)):a.key==="ArrowRight"?St().catch(i=>console.error("[pronunciation-coach] arrow-right failed:",i)):a.key==="Escape"?bt():(a.key===" "||a.code==="Space")&&(a.preventDefault(),ne==="idle"&&q&&k?gn().catch(i=>console.error("[pronunciation-coach] space-start failed:",i)):ne==="recording"&&bn().catch(i=>console.error("[pronunciation-coach] space-stop failed:",i)))};window.addEventListener("keydown",kn);const na=700,ra=8;let at=null,We=null,ot=null;const je=()=>{at!==null&&(window.clearTimeout(at),at=null),We=null,ot=null},Tn=a=>{var d,g;const i=(g=(d=a.target)==null?void 0:d.closest)==null?void 0:g.call(d,"[data-pc-lang-badge]");if(!i)return;const l=i.getAttribute("data-pc-lang")||"";l&&(We={x:a.clientX,y:a.clientY},ot=l,at=window.setTimeout(()=>{at=null,ot&&!s&&Dn(ot),ot=null,We=null},na))},En=a=>{if(!We)return;const i=a.clientX-We.x,l=a.clientY-We.y;Math.hypot(i,l)>ra&&je()};e.addEventListener("pointerdown",Tn),e.addEventListener("pointermove",En),e.addEventListener("pointerup",je),e.addEventListener("pointercancel",je);const aa=()=>{const a=cn(pe);if(!a||!a.phrases||a.phrases.length===0)return!1;ce=Math.max(0,Math.floor(a.streak)),V.length=0;for(const l of a.phrases)V.push(ir(l));const i=Math.max(0,Math.min(V.length-1,a.idx));return W=i,k=V[i],k&&se(),Ze(),!0},oa=async()=>{const a=t.getStackConfig();if(!a.languages||a.languages.length<1){k=null,G(b,"No language selected","Open Corpán settings and choose a language to practise."),_.disabled=!0,h.textContent="—";return}if(aa()){console.log(`[pronunciation-coach] restored ${V.length} phrase(s) from storage; idx=${W}, streak=${ce}`),Se();return}try{const i=await Fe();if(s)return;if(!i){x("No phrases available — check your stack config.");return}V.push(i),W=0,k=i,se(),xe(),Se()}catch(i){console.error("[pronunciation-coach] loadFirstPhrase failed:",i),k=null,x(`Could not load a phrase: ${ge(i)}`),_.disabled=!0,h.textContent="—"}},sa=a=>new Promise(i=>{let{currentActive:l}=a;const d=document.createElement("div");d.className="pc-setup-root",d.innerHTML=`
        <div class="pc-backdrop"></div>
        <div class="pc-setup">
          <div class="pc-setup-header">
            <div class="pc-subtitle">Speech Models</div>
            <button class="pc-close" id="pc-setup-close" type="button" aria-label="Close">×</button>
          </div>
          <div class="pc-setup-body">
            <h1 class="pc-setup-headline">${Z(a.headline)}</h1>
            <p class="pc-setup-sub">${Z(a.sub)}</p>

            ${Ct().map(u=>{const I=u.approxSizeMB>=1e3?`~${(u.approxSizeMB/1e3).toFixed(1)} GB`:`~${u.approxSizeMB} MB`;return`
            <div class="pc-setup-card" data-mode="${u.id}">
              <div class="pc-setup-card-head">
                <div>
                  <div class="pc-setup-card-name">${Z(u.label)} <span class="pc-setup-card-status" data-status="${u.id}"></span></div>
                  <div class="pc-setup-card-meta">${I}</div>
                </div>
                <div class="pc-setup-card-actions" data-actions="${u.id}"></div>
              </div>
              <div class="pc-setup-card-desc">${Z(u.shortDesc)}</div>
              <div class="pc-setup-card-procon">
                <ul class="pc-setup-card-pros">
                  ${u.pros.map(X=>`<li>${Z(X)}</li>`).join("")}
                </ul>
                <ul class="pc-setup-card-cons">
                  ${u.cons.map(X=>`<li>${Z(X)}</li>`).join("")}
                </ul>
              </div>
              <div class="pc-setup-card-techid" title="Underlying model file (whisper.cpp ggml format)">${Z(u.folder)}</div>
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
      `,e.appendChild(d);const g=d.querySelector(".pc-setup-body"),R=d.querySelector(".pc-setup-card");let N=null;const T=()=>{if(en()){N&&(N.remove(),N=null);return}if(N||!g)return;N=er({title:"Model downloads need internet",subtitle:"Already-installed models still work. Reconnect to install or reinstall a model."}).element,N.style.marginBottom="12px",R&&R.parentNode===g?g.insertBefore(N,R):g.appendChild(N)};T();let H=()=>{};const U=d.querySelector("#pc-setup-error"),S=Object.fromEntries(Ct().map(u=>[u.id,u.id===l?!0:null]));let j=null;const ue=(u,I)=>{const X=d.querySelector(`[data-progress="${u}"]`);X&&(X.hidden=!I)},we=(u,I,X)=>{const C=d.querySelector(`[data-progress="${u}"]`);if(!C)return;const te=C.querySelector(".pc-setup-progress-fill");te&&(te.style.width=`${Math.round(Math.max(0,Math.min(1,I))*100)}%`);const re=C.querySelector(".pc-setup-progress-label");re&&(re.textContent=X)},st=()=>{H(),d.parentNode&&d.parentNode.removeChild(d)},$e=()=>{for(const u of Ie){const I=u.id,X=d.querySelector(`[data-status="${I}"]`),C=d.querySelector(`[data-actions="${I}"]`);if(!X||!C)continue;const te=l===I,re=j===I,le=te?!0:S[I],_e=le===null&&!te&&!re;if(X.textContent=re?"Installing…":te?"Active":_e?"Checking…":le?"Installed":"Not installed",X.dataset.state=re?"installing":te?"active":_e?"checking":le?"installed":"absent",C.innerHTML="",re||_e)continue;const Pe=(Ut,xt,ke,Wt={})=>{const Re=document.createElement("button");Re.type="button",Re.className=`pc-setup-btn pc-setup-btn-${xt}`,Re.textContent=Ut,Wt.disabled&&(Re.disabled=!0),Re.addEventListener("click",ke),C.appendChild(Re)},Mt=!en();le?te||(Pe("Use this","primary",()=>{console.log(`[pronunciation-coach] CLICK Use-this mode=${I}`),Ce(I)}),Pe("Reinstall","ghost",()=>{console.log(`[pronunciation-coach] CLICK Reinstall mode=${I}`),ct(I,!0)},{disabled:Mt}),Pe("Remove","danger",()=>{console.log(`[pronunciation-coach] CLICK Remove mode=${I}`),Et(I)})):Pe("Install","primary",()=>{console.log(`[pronunciation-coach] CLICK Install mode=${I}`),ct(I)},{disabled:Mt})}};H=Qn(()=>{T(),$e()});const it=async()=>{if(n!=null&&n.validateModel){for(const u of Ie){if(l===u.id){S[u.id]=!0;continue}try{const I=await n.validateModel({model:u.folder});S[u.id]=I.valid}catch(I){console.error(`[pronunciation-coach] validate ${u.id} failed:`,I),S[u.id]=!1}}$e()}},Ce=u=>{st(),i({kind:"selected",mode:u})},Et=async u=>{if(j||!(n!=null&&n.wipeModel))return;console.log(`[pronunciation-coach] removeModel: mode=${u} folder=${ve(u)} currentActive=${l??"null"} installed[${u}]=${S[u]}`);const I=S[u];j=u,$e(),U.hidden=!0;try{await n.wipeModel({model:ve(u)}),S[u]=!1,l===u&&(l=null)}catch(X){S[u]=I;const C=ge(X);U.textContent=`Remove failed: ${C}`,U.hidden=!1}finally{j=null,$e()}},ct=async(u,I=!1)=>{var X;if(!(j||s||!(n!=null&&n.installModel))){if(j=u,U.hidden=!0,U.textContent="",$e(),ue(u,!0),I&&(n!=null&&n.wipeModel)){we(u,0,"Wiping previous install…");try{await n.wipeModel({model:ve(u)})}catch(C){console.warn("[pronunciation-coach] pre-reinstall wipe failed (continuing):",C)}}we(u,0,"Starting…");try{if(await n.installModel({model:ve(u),downloadUrl:(X=fe(u))==null?void 0:X.downloadUrl},C=>{if(C.model===ve(u))if(C.phase==="downloading"){let re=`Downloading ${Math.round((C.fraction??0)*100)}%`;if(C.completed!=null&&C.total&&C.total>0){const le=_e=>(_e/1048576).toFixed(0);re+=` · ${le(C.completed)} / ${le(C.total)} MB`}we(u,C.fraction??0,re)}else C.phase==="verifying"?we(u,1,"Verifying files…"):C.phase==="verified"?we(u,1,"Verified ✓"):C.phase==="failed"&&we(u,0,`Failed: ${C.error??"unknown"}`)}),s)return;S[u]=!0,j=null,we(u,1,"Verified ✓"),setTimeout(()=>{st(),i({kind:"selected",mode:u})},300)}catch(C){j=null,ue(u,!1);const te=ge(C),re=Ve(C);if(console.error(`[pronunciation-coach] install ${u} failed (code=${re??"—"}):`,te),re==="STT_UNAVAILABLE"?U.textContent="Parlometron needs on-device speech recognition that isn't available on this device. Try Parlometron on iPhone, iPad, or an Android phone.":U.textContent=`Install failed: ${te}`,U.hidden=!1,l&&l!==u&&(n!=null&&n.prepare))try{(await n.prepare({model:ve(l)})).ready&&console.log(`[pronunciation-coach] restored ${l} kit after ${u} install failed`)}catch(le){console.error(`[pronunciation-coach] kit restore after ${u} install failure threw:`,le)}$e()}}},lt=d.querySelector("#pc-setup-close");if(lt==null||lt.addEventListener("click",()=>{j||(st(),l&&S[l]?i({kind:"cancelled"}):(bt(),i({kind:"exit"})))}),l){const u=d.querySelector(`[data-mode="${l}"]`);u==null||u.classList.add("pc-setup-card-suggested")}$e(),it().catch(u=>{console.error("[pronunciation-coach] refreshInstallState threw:",u)})});return(async()=>{var U;K("Checking models…");let a;try{a=await n.isAvailable()}catch(S){if(console.error("[pronunciation-coach] stt.isAvailable bridge call threw:",S),s)return;Y(),v("Speech recognition bridge failed",`The native speech-recognition plugin returned an error: ${String(S)}`);return}if(s)return;if(!a){Y(),v();return}try{const S=await n.getStatus();_n(S.availableMemoryMB??null,S.physicalMemoryMB??null),console.log(`[pronunciation-coach] device memory budget: available=${S.availableMemoryMB??"?"}MB physical=${S.physicalMemoryMB??"?"}MB raw=${JSON.stringify(S)}`)}catch(S){console.warn("[pronunciation-coach] getStatus failed; using conservative budget (Large variants hidden):",S)}const i=cn(pe);i!=null&&i.mode&&fe(i.mode)&&(E=i.mode);const l=fe(E);if(l&&qn(l)){const S=In().id;console.warn(`[pronunciation-coach] saved model "${E}" exceeds this device's memory budget; demoting to "${S}"`),E=S}He();const d=Q(E),g=(((U=fe(E))==null?void 0:U.approxSizeMB)??0)>=300;K(g?`Loading ${d} model… first load can take ~1 minute for large models. Subsequent launches are faster.`:`Loading ${d} model…`),h.textContent=g?`Loading ${d} model… (first time can take ~1 minute)`:`Loading ${d} model…`;const R=E;let N=null,T;try{await Promise.all([Nt(R).then(S=>{q=!0,console.log(`[pronunciation-coach] WhisperKit prepared: ${S.model} (${Q(R)})`)}),oa()])}catch(S){N=S,T=Ve(S),console.error(`[pronunciation-coach] boot prepare failed (code=${T??"—"}):`,ge(S));const j=ge(S);!T&&/<model dir missing>|Run install first/i.test(j)&&console.warn("%c[pronunciation-coach] STALE PLUGIN DETECTED","background:#9333ea;color:#fff;padding:2px 6px;border-radius:4px;font-weight:600","\nThe host app is running an old tauri-plugin-stt binary (no `code` field on errors, no marker file).",`
ValidateModel false-negatives in that build trigger destructive wipes on every Install click.`,`
Fix: rebuild and reinstall the host app (cargo tauri ios dev / android dev) to pick up the marker-file fix.`)}if(s)return;if(q&&!N){Y(),ee("idle");return}Y();const H=Q(R);if(T==="STT_UNAVAILABLE"){x("Parlometron needs on-device speech recognition that isn't available on this device. Try Parlometron on iPhone, iPad, or an Android phone."),_.disabled=!0,h.textContent="Not supported on this device";return}if(T==="NETWORK"){x(`${H} needs internet to finish setting up. Reconnect and tap the model badge to retry — your downloaded files are intact.`),_.disabled=!0,h.textContent="Reconnect to load";return}if(T&&T!=="MODEL_NOT_INSTALLED"&&T!=="LOAD_FAILED"){x(`Model failed to load: ${ge(N)}`),_.disabled=!0,h.textContent="Model unavailable";return}T==="LOAD_FAILED"&&x(`${H} model failed to load. Use Reinstall in setup if it keeps happening.`),_.disabled=!0,h.textContent=`Loading ${H} model…`,Ht().catch(S=>{console.error("[pronunciation-coach] openModelSetup after boot prepare failure threw:",S)})})().catch(a=>{console.error("[pronunciation-coach] boot threw:",a)}),{unmount:()=>{s=!0,tt(),window.removeEventListener("keydown",kn),e.removeEventListener("pointerdown",Tn),e.removeEventListener("pointermove",En),e.removeEventListener("pointerup",je),e.removeEventListener("pointercancel",je),je(),Y(),f(),e.innerHTML=""}}},qt=3,dn="pc:parlometron:game-state",br=()=>{try{return crypto.randomUUID()}catch{return`p_${Math.random().toString(36).slice(2,10)}_${Date.now()}`}},At=e=>({id:br(),name:e}),wr=(e,t)=>{if(e.length<2)throw new Error("Parlometron needs at least 2 players");return{players:e.map(r=>({...r})),winTarget:t,currentRound:0,currentRoundOrder:[],currentPlayerIdx:0,attemptsLeft:{},bestThisRound:{},expectedTextThisRound:"",roundsWon:Object.fromEntries(e.map(r=>[r.id,0])),history:[]}},Lr=e=>{const t=e.slice();for(let r=t.length-1;r>0;r--){const n=Math.floor(Math.random()*(r+1));[t[r],t[n]]=[t[n],t[r]]}return t},Sr=(e,t)=>(e.currentRound+=1,e.currentRoundOrder=Lr(e.players.map(r=>r.id)),e.currentPlayerIdx=0,e.attemptsLeft=Object.fromEntries(e.players.map(r=>[r.id,qt])),e.bestThisRound=Object.fromEntries(e.players.map(r=>[r.id,null])),e.expectedTextThisRound=t,e),$r=(e,t,r)=>{const n=e.currentRoundOrder[e.currentPlayerIdx];if(!n||(e.attemptsLeft[n]??0)<=0)return e;const s=e.bestThisRound[n],o=Math.max(0,Math.min(100,Math.round(t)));return(!s||o>s.bestPercent)&&(e.bestThisRound[n]={playerId:n,bestPercent:o,heardText:r}),e.attemptsLeft[n]=Math.max(0,(e.attemptsLeft[n]??0)-1),e},kr=e=>{const t=e.currentRoundOrder[e.currentPlayerIdx];return t&&(e.attemptsLeft[t]=0),e.currentPlayerIdx+=1,e},Tr=e=>e.currentPlayerIdx>=e.currentRoundOrder.length,Er=e=>e.players.some(t=>(e.roundsWon[t.id]??0)>=e.winTarget),Mr=e=>{let t=-1;for(const r of e.players){const n=e.roundsWon[r.id]??0;n>t&&(t=n)}return t<1?[]:e.players.filter(r=>(e.roundsWon[r.id]??0)===t)},xr=e=>{var o;const t=e.players.map(c=>e.bestThisRound[c.id]??{playerId:c.id,bestPercent:0,heardText:""}).sort((c,p)=>p.bestPercent-c.bestPercent),r=((o=t[0])==null?void 0:o.bestPercent)??0,n=r>0?t.filter(c=>c.bestPercent===r).map(c=>c.playerId):[];for(const c of n)e.roundsWon[c]=(e.roundsWon[c]??0)+1;const s={round:e.currentRound,expectedText:e.expectedTextThisRound,results:t,winnerIds:n};return e.history.push(s),{state:e,round:s}},Pt=e=>{const t=e.currentRoundOrder[e.currentPlayerIdx];return t?e.players.find(r=>r.id===t)??null:null},wt=e=>{try{localStorage.setItem(dn,JSON.stringify(e))}catch(t){console.error("[parlometron/state] save failed:",t)}},Xe=()=>{try{localStorage.removeItem(dn)}catch(e){console.error("[parlometron/state] clear failed:",e)}},Lt=2,Je=8,pn=e=>e.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/'/g,"&#39;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),Cr=e=>{var w,D;const t=((w=e.initial)==null?void 0:w.players.map(m=>({...m})))??[At("Player 1"),At("Player 2")];let r=((D=e.initial)==null?void 0:D.winTarget)??5;const n=()=>{const m=[3,5,7].map(y=>`
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
          <h3 class="pc-pm-section-title">Players (${t.length} / ${Je})</h3>
          <ul class="pc-pm-roster" id="pc-pm-roster">${s()}</ul>
          <button class="pc-pm-add" data-pm-add
                  ${t.length>=Je?"disabled":""}>
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
                 value="${pn(m.name)}"
                 maxlength="24"
                 placeholder="Player name"
                 autocapitalize="words"
                 autocorrect="off"
                 spellcheck="false" />
          <button class="pc-pm-roster-remove"
                  data-pm-remove="${m.id}"
                  aria-label="Remove ${pn(m.name)}"
                  ${t.length<=Lt?"disabled":""}>×</button>
        </li>`).join(""),o=()=>{const m=e.container.querySelector("#pc-pm-start");if(!m)return;const y=t.every(L=>L.name.trim().length>0);m.disabled=!y||t.length<Lt},c=()=>{const m=e.container.querySelector("[data-pm-add]");m&&(m.disabled=t.length>=Je)},p=()=>{const m=e.container.querySelector("#pc-pm-roster");m&&(m.innerHTML=s());const y=e.container.querySelector(".pc-pm-section-title");y&&(y.textContent=`Players (${t.length} / ${Je})`),f(),c(),o()},f=()=>{e.container.querySelectorAll("[data-pm-name]").forEach(m=>{const y=m.getAttribute("data-pm-name")||"";m.addEventListener("input",()=>{const L=t.find(F=>F.id===y);L&&(L.name=m.value),o()})}),e.container.querySelectorAll("[data-pm-remove]").forEach(m=>{m.addEventListener("click",()=>{if(t.length<=Lt)return;const y=m.getAttribute("data-pm-remove")||"",L=t.findIndex(F=>F.id===y);L>=0&&(t.splice(L,1),p())})})},v=()=>{var m,y,L;(m=e.container.querySelector("[data-pm-back]"))==null||m.addEventListener("click",()=>e.onBack()),(y=e.container.querySelector("[data-pm-add]"))==null||y.addEventListener("click",()=>{t.length>=Je||(t.push(At(`Player ${t.length+1}`)),p())}),e.container.querySelectorAll("[data-pm-target]").forEach(F=>{F.addEventListener("click",()=>{const b=Number(F.getAttribute("data-pm-target"));(b===3||b===5||b===7)&&(r=b,e.container.querySelectorAll("[data-pm-target]").forEach(_=>{_.classList.toggle("active",Number(_.getAttribute("data-pm-target"))===b)}))})}),(L=e.container.querySelector("#pc-pm-start"))==null||L.addEventListener("click",()=>{const F=t.map(_=>({..._,name:_.name.trim()})).filter(_=>_.name.length>0);if(F.length<Lt)return;const b=wr(F,r);e.onStart(b)}),f()};return n(),{unmount:()=>{e.container.innerHTML=""}}},Ot=e=>e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),un=e=>new Promise(t=>{var o,c,p;const r=document.createElement("div");r.className="pc-pm-confirm-root",r.innerHTML=`
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
      </div>`,document.body.appendChild(r),requestAnimationFrame(()=>r.classList.add("open"));const n=f=>{r.classList.remove("open"),window.setTimeout(()=>{r.parentNode&&r.parentNode.removeChild(r)},200),window.removeEventListener("keydown",s),t(f)},s=f=>{f.key==="Escape"?n(!1):f.key==="Enter"&&n(!0)};window.addEventListener("keydown",s),(o=r.querySelector("[data-pm-confirm-backdrop]"))==null||o.addEventListener("click",()=>n(!1)),(c=r.querySelector("[data-pm-confirm-cancel]"))==null||c.addEventListener("click",()=>n(!1)),(p=r.querySelector("[data-pm-confirm-go]"))==null||p.addEventListener("click",()=>n(!0))}),_r=9e4,Rr=()=>`pm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`,Qe=e=>e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),Ir=e=>Qe(e).replace(/"/g,"&quot;").replace(/'/g,"&#39;"),qr=e=>e?e.split("-")[0].toLowerCase():"en",Ar=async(e,t,r)=>{let n=null;const s=new Promise((o,c)=>{n=setTimeout(()=>{c(new Error(`${r} timed out after ${Math.round(t/1e3)}s`))},t)});try{return await Promise.race([e,s])}finally{n&&clearTimeout(n)}},Pr=(e,t)=>{if(t.length<=1){const o=t[0];return{target:o?e.translations.find(p=>p.language_code===o)??null:null,native:null}}const r=t.length>0?e.translations.find(o=>o.language_code===t[0])??null:null,n=[];for(const o of t.slice(1)){const c=e.translations.find(p=>p.language_code===o);c&&n.push(c)}return{target:n.length>0?n[Math.floor(Math.random()*n.length)]:null,native:r}},Or=e=>{var Me;const t=e.hostApi.stt;if(!t)return e.container.innerHTML=`
      <div class="pc-pm-root pc-pm-error">
        <p>Whisper STT is not available on this device.</p>
        <button class="pc-pm-start" data-pm-quit>Back</button>
      </div>`,(Me=e.container.querySelector("[data-pm-quit]"))==null||Me.addEventListener("click",e.onQuit),{unmount:()=>e.container.innerHTML=""};let r=!1,n="loading",s=null,o=null,c=null,p=null,f=null;const v=()=>{var $,M,B,ae;e.container.innerHTML=`
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
      </div>`,($=e.container.querySelector("[data-pm-quit]"))==null||$.addEventListener("click",async()=>{await un({message:"Quit this game? Scores will be lost.",confirmLabel:"Quit",cancelLabel:"Keep playing",destructive:!0})&&(s&&(t.cancelSession({sessionId:s}).catch(P=>console.error("[parlometron/round] cancel failed:",P)),s=null),e.onQuit())}),(M=e.container.querySelector("[data-pm-mic]"))==null||M.addEventListener("click",m),(B=e.container.querySelector("[data-pm-pass]"))==null||B.addEventListener("click",b),(ae=e.container.querySelector("[data-pm-splash-go]"))==null||ae.addEventListener("click",()=>{n="ready",w()});const h=e.container.querySelector("[data-pm-target]");h&&h.addEventListener("click",()=>{const z=o==null?void 0:o.text,P=o==null?void 0:o.language_code;if(!(!z||!P))try{const K=e.hostApi.speak(P,z);K&&typeof K.catch=="function"&&K.catch(Y=>console.error("[parlometron/round] phrase speak failed:",Y))}catch(K){console.error("[parlometron/round] phrase speak threw:",K)}})},w=()=>{if(r)return;const h=Pt(e.game),$=h?e.game.attemptsLeft[h.id]??0:0,M=qt-$,B=h?e.game.currentRoundOrder.indexOf(h.id)+1:e.game.currentRoundOrder.length,ae=e.game.currentRoundOrder.length,z=E=>e.container.querySelector(E),P=z("[data-pm-eyebrow]");if(P){const E=o!=null&&o.language_code?o.language_code.split("-")[0].toUpperCase():"",oe=E?` · ${E}`:"";P.textContent=`Round ${e.game.currentRound}${oe} · First to ${e.game.winTarget}`}const K=z("[data-pm-headline]");K&&(K.textContent=`${(h==null?void 0:h.name)??"—"}'s turn`);const Y=z("[data-pm-turn]");Y&&(Y.textContent=`${B} / ${ae}`);const x=z("[data-pm-target]");x&&(x.textContent=(o==null?void 0:o.text)??"Loading…");const ye=z("[data-pm-roman]");if(ye){const oe=!!e.hostApi.getStackConfig().showRomanization,pe=((o==null?void 0:o.romanization)??"").trim();oe&&pe?(ye.textContent=pe,ye.hidden=!1):ye.hidden=!0}const ne=z("[data-pm-native]");if(ne){const E=((c==null?void 0:c.text)??"").trim();E?(ne.textContent=E,ne.hidden=!1):ne.hidden=!0}D();const q=z("[data-pm-mic]"),k=z("[data-pm-mic-label]"),V=z("[data-pm-tries]");q&&(q.classList.remove("recording","scoring"),q.disabled=n==="scoring"||n==="loading",n==="recording"?q.classList.add("recording"):n==="scoring"&&q.classList.add("scoring")),k&&(k.textContent=n==="loading"?"Loading…":n==="passing"?`${(h==null?void 0:h.name)??"—"}, get ready`:n==="recording"?"Tap to stop":n==="scoring"?"Scoring…":n==="result"&&$>0?"Tap to try again":n==="result"?"Tap mic or pass":"Tap to speak"),V&&(V.innerHTML=Array.from({length:qt},(E,oe)=>`<span class="pc-pm-try-dot ${oe<M?"used":""}"></span>`).join(""));const W=z("[data-pm-pass]");W&&W.classList.toggle("is-invisible",n!=="result");const be=z("[data-pm-splash]"),ce=z("[data-pm-splash-name]");be&&(be.hidden=n!=="passing"),ce&&(ce.textContent=(h==null?void 0:h.name)??"next player")},D=()=>{var et;const h=e.container.querySelector("[data-pm-banner]"),$=e.container.querySelector("[data-pm-transcript]"),M=e.container.querySelector("[data-pm-detail]");if(!h||!$||!M)return;if(f&&!p){h.className="pc-result-banner bad",h.innerHTML=`<span class="pc-result-banner-text">${Qe(f)}</span>`,h.hidden=!1,$.hidden=!0,M.hidden=!0,$.innerHTML="",M.innerHTML="";return}if(!p||n!=="result"){h.hidden=!0,$.hidden=!0,M.hidden=!0,h.innerHTML="",$.innerHTML="",M.innerHTML="";return}const B=p,ae=Math.max(0,Math.min(1,B.overallScore)),z=Math.round(ae*100),P=ae>=.85?"good":ae>=.6?"okay":"bad",K=P==="good"?"Nailed it":P==="okay"?"Close — try again":"";h.className=`pc-result-banner ${P}`,h.innerHTML=K?`
      <span class="pc-result-banner-score">${z}%</span>
      <span class="pc-result-banner-sep">·</span>
      <span class="pc-result-banner-text">${Qe(K)}</span>`:`<span class="pc-result-banner-score">${z}%</span>`,h.hidden=!1;const Y=(B.freeText||B.text||"").trim(),x=an((o==null?void 0:o.language_code)??B.language??""),ye=x?"pc-transcript-line pc-transcript-line-rtl":"pc-transcript-line",ne=x?"◀":"▶";Y?($.innerHTML=`
        <div class="pc-transcripts">
          <div class="pc-transcript-row heard" role="button" tabindex="0"
               data-pm-speak-heard
               aria-label="Play what Whisper heard">
            <span class="pc-transcript-label">Heard you say</span>
            <span class="${ye}">
              <span class="pc-transcript-play" aria-hidden="true">${ne}</span>
              <span class="pc-transcript-text">${Qe(Y)}</span>
            </span>
          </div>
        </div>`,$.hidden=!1,(et=$.querySelector("[data-pm-speak-heard]"))==null||et.addEventListener("click",()=>{const O=o==null?void 0:o.language_code;if(O)try{const G=e.hostApi.speak(O,Y);G&&typeof G.catch=="function"&&G.catch(se=>console.error("[parlometron/round] heard speak failed:",se))}catch(G){console.error("[parlometron/round] heard speak threw:",G)}})):($.innerHTML="",$.hidden=!0);const q=((o==null?void 0:o.text)??"").trim(),k=(o==null?void 0:o.language_code)??B.language??"",V=on(B.words??[]),W=vt(q),be=vt(Y),ce=W.length>0&&W.length===V.length,E=W.length>0&&W.length===be.length,oe=Y.length&&q.length?yt(Ee(Y,k),Ee(q,k)):null,pe=W.length?W.map((O,G)=>({word:O,heardProb:ce?V[G].probability:null,freeSim:E?yt(Ee(O,k),Ee(be[G],k)):oe})):q?[{word:q,heardProb:null,freeSim:oe}]:[],xe=O=>O===null?null:O>=.9?"good":O>=.6?"okay":"bad",He=O=>O===null?null:O>=.85?"good":O>=.6?"okay":"bad",Ze={bad:0,okay:1,good:2},ee=O=>{const G=xe(O.heardProb),se=He(O.freeSim);return G===null&&se===null?"":G===null?se:se===null||Ze[G]<=Ze[se]?G:se},ze=pe.map((O,G)=>`<button class="pc-word ${ee(O)}" type="button"
                   data-pm-word-idx="${G}"
                   aria-label="Speak ${Ir(O.word)}">${Qe(O.word)}</button>`).join(""),Le=x?"pc-words pc-words-rtl":"pc-words";M.innerHTML=ze?`<div class="${Le}">${ze}</div>`:"",M.hidden=!ze,M.querySelectorAll("[data-pm-word-idx]").forEach(O=>{O.addEventListener("click",()=>{var Fe;const G=Number(O.getAttribute("data-pm-word-idx")),se=(Fe=pe[G])==null?void 0:Fe.word.trim(),De=o==null?void 0:o.language_code;if(!(!se||!De))try{const Se=e.hostApi.speak(De,se);Se&&typeof Se.catch=="function"&&Se.catch(St=>console.error("[parlometron/round] word speak failed:",St))}catch(Se){console.error("[parlometron/round] word speak threw:",Se)}})})},m=()=>{n==="ready"?L():n==="recording"?F():n==="result"&&y()?(p=null,n="ready",w(),L()):n==="result"&&b()},y=()=>{const h=Pt(e.game);return h?(e.game.attemptsLeft[h.id]??0)>0:!1},L=async()=>{if(r||!Pt(e.game))return;const $=Rr();s=$,p=null,f=null,n="recording",w();try{const M=qr((o==null?void 0:o.language_code)??"en"),B=await t.startSession({sessionId:$,language:M,expectedText:(o==null?void 0:o.text)??"",whisperParams:Xt(M),scoringParams:Qt(M,void 0)});if(r)return;if(!B.started)throw new Error("STT did not start")}catch(M){console.error("[parlometron/round] startSession failed:",M),s=null,n="ready",w()}},F=async()=>{if(r)return;const h=s;if(h){s=null,n="scoring",w();try{const $=await Ar(t.stopSession({sessionId:h}),_r,"Scoring");if(r)return;const M=Math.round(Math.max(0,Math.min(1,$.overallScore))*100),B=$.text||$.freeText||"";$r(e.game,M,B),wt(e.game),p=$,n="result",w()}catch($){const M=($==null?void 0:$.message)??String($),B=$==null?void 0:$.code;if(console.error(`[parlometron/round] stopSession failed (code=${B??"—"}):`,M),r)return;f=B==="NOT_PREPARED"||/not prepared/i.test(M)?"Speech model isn't loaded yet. Open Practice once to install it.":`Couldn't score this attempt: ${M}`,p=null,n="ready",w()}}},b=()=>{if(!r){if(kr(e.game),wt(e.game),Tr(e.game)){const{round:h}=xr(e.game);wt(e.game),e.onRoundDone(h);return}p=null,f=null,n="passing",w()}};return(async()=>{var h,$,M;v(),n="loading",w();try{const B=e.hostApi.getStackConfig();if(!B.languages||B.languages.length<1){e.container.innerHTML=`
          <div class="pc-pm-root pc-pm-error">
            <p>Choose a language in your Corpán stack before starting Parlometron.</p>
            <button class="pc-pm-start" data-pm-quit>Back</button>
          </div>`,(h=e.container.querySelector("[data-pm-quit]"))==null||h.addEventListener("click",e.onQuit);return}const ae=e.hostApi.getRandomEntry;if(!ae)throw new Error("hostApi.getRandomEntry unavailable");const z=await ae();if(r)return;const{target:P,native:K}=Pr(z,B.languages);if(!P){e.container.innerHTML=`
          <div class="pc-pm-root pc-pm-error">
            <p>This phrase doesn't have a translation in your target language.</p>
            <button class="pc-pm-start" data-pm-quit>Back</button>
          </div>`,($=e.container.querySelector("[data-pm-quit]"))==null||$.addEventListener("click",e.onQuit);return}o=P,c=K,Sr(e.game,P.text),wt(e.game),n="passing",w()}catch(B){if(console.error("[parlometron/round] boot failed:",B),r)return;e.container.innerHTML=`
        <div class="pc-pm-root pc-pm-error">
          <p>Couldn't load a phrase. Try again later.</p>
          <button class="pc-pm-start" data-pm-quit>Back</button>
        </div>`,(M=e.container.querySelector("[data-pm-quit]"))==null||M.addEventListener("click",e.onQuit)}})(),{unmount:()=>{r=!0,s&&(t.cancelSession({sessionId:s}).catch(h=>console.error("[parlometron/round] unmount cancel:",h)),s=null),e.container.innerHTML=""}}},Ae=e=>e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),mn=(e,t)=>e.players.find(r=>r.id===t),Nr=e=>{const{game:t,round:r}=e,n=r.winnerIds.map(p=>{var f;return((f=mn(t,p))==null?void 0:f.name)??"—"}).filter(Boolean),s=n.length===0?"No round winner.":n.length===1?`${n[0]} wins the round`:`${n.join(" & ")} tie for the round`,o=r.results.map(p=>{const f=mn(t,p.playerId),v=r.winnerIds.includes(p.playerId),w=t.roundsWon[p.playerId]??0;return`
        <tr class="${v?"winner":""}">
          <td class="pc-pm-score-name">${Ae((f==null?void 0:f.name)??"—")}</td>
          <td class="pc-pm-score-pct">${p.bestPercent}%</td>
          <td class="pc-pm-score-heard">${Ae((p.heardText||"—").slice(0,60))}</td>
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
    </div>`,(()=>{var f,v,w;const p=async()=>{await un({message:"Quit this game?",confirmLabel:"Quit",cancelLabel:"Keep playing",destructive:!0})&&e.onQuit()};(f=e.container.querySelector("[data-pm-quit]"))==null||f.addEventListener("click",p),(v=e.container.querySelector("[data-pm-quit2]"))==null||v.addEventListener("click",p),(w=e.container.querySelector("[data-pm-next]"))==null||w.addEventListener("click",()=>e.onNextRound())})(),{unmount:()=>{e.container.innerHTML=""}}},Br=e=>{var c,p;const{game:t}=e,r=Mr(t),n=r.length===0?"Game over":r.length===1?`${r[0].name} wins!`:`${r.map(f=>f.name).join(" & ")} tie!`,o=[...t.players].sort((f,v)=>(t.roundsWon[v.id]??0)-(t.roundsWon[f.id]??0)).map((f,v)=>{const w=t.roundsWon[f.id]??0,D=r.some(L=>L.id===f.id),m=t.history.map(L=>L.results.find(F=>F.playerId===f.id)).filter(L=>!!L),y=m.length?Math.round(m.reduce((L,F)=>L+F.bestPercent,0)/m.length):0;return`
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
    </div>`,(c=e.container.querySelector("[data-pm-done]"))==null||c.addEventListener("click",()=>e.onDone()),(p=e.container.querySelector("[data-pm-again]"))==null||p.addEventListener("click",()=>e.onPlayAgain()),{unmount:()=>{e.container.innerHTML=""}}},Hr="pc:parlometron:last-mode",zr="corpan-pronunciation-coach:v2",Dr=()=>{let e=null;try{const t=localStorage.getItem(zr);if(t){const r=JSON.parse(t),n=fe(r.mode);n&&(e=n.folder)}}catch(t){console.warn("[parlometron] reading saved model failed:",t)}return e??Kt().folder},Fr=e=>{const t=e.stt;if(!(t!=null&&t.prepare))return;const r=Dr();console.log("[parlometron] ensureModelPrepared — calling prepare:",r),t.prepare({model:r}).then(n=>{n.ready?console.log(`[parlometron] model ready: ${n.model??r}`):console.warn(`[parlometron] prepare reported not ready (code=${n.code??"—"}): ${n.message??""}`)}).catch(n=>{console.warn("[parlometron] prepare threw:",n)})},Ur=(e,t)=>{let r=null,n=null,s=null;const o=()=>{if(r){try{r.unmount()}catch(m){console.error("[parlometron] unmount threw:",m)}r=null}},c=()=>{var m;o(),n=null,e.innerHTML=`
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
      </div>`,(m=e.querySelector("[data-pm-picker-close]"))==null||m.addEventListener("click",()=>{try{window.dispatchEvent(new CustomEvent("corpan:exit"))}catch(y){console.error("[parlometron] dispatch exit failed:",y)}}),e.querySelectorAll("[data-pm-mode]").forEach(y=>y.addEventListener("click",()=>{const L=y.getAttribute("data-pm-mode");try{localStorage.setItem(Hr,L??"")}catch{}L==="practice"?p():L==="friends"&&(Xe(),f(s??void 0))})),r={unmount:()=>{e.innerHTML=""}}},p=()=>{o(),r=yr(e,t,{onClose:()=>c()})},f=m=>{o(),r=Cr({container:e,onBack:()=>c(),onStart:L=>{n=L,s={players:L.players.map(F=>({...F})),winTarget:L.winTarget},v()},initial:m})},v=()=>{if(!n){c();return}o(),r=Or({container:e,hostApi:t,game:n,onRoundDone:y=>{n&&(Er(n)?D():w(y))},onQuit:()=>{Xe(),n=null,c()}})},w=m=>{if(!n){c();return}o(),r=Nr({container:e,game:n,round:m,onNextRound:()=>v(),onQuit:()=>{Xe(),n=null,c()}})},D=()=>{if(!n){c();return}o(),r=Br({container:e,game:n,onPlayAgain:()=>{const y=s;Xe(),n=null,f(y??void 0)},onDone:()=>{Xe(),n=null,c()}})};return Fr(t),c(),{unmount:()=>{var y;o(),e.innerHTML="";const m=t.stt;(y=m==null?void 0:m.releaseAudio)==null||y.call(m).catch(L=>{console.error("[parlometron] releaseAudio failed:",L)})}}},Wr="/__console",jr="8990";function Gr(){var r,n;if(typeof document>"u")return null;const e=((n=(r=document.currentScript)==null?void 0:r.dataset)==null?void 0:n.corpGameBaseUrl)??null;if(!e)return null;let t;try{t=new URL(e)}catch{return null}return t.protocol!=="http:"?null:`${t.protocol}//${t.hostname}:${jr}${Wr}`}function Yr(e){if(e==null||typeof e=="string"||typeof e=="number"||typeof e=="boolean")return e;if(e instanceof Error)return{__error:!0,name:e.name,message:e.message,stack:e.stack};try{return JSON.stringify(e),e}catch{try{return String(e)}catch{return"[unserializable]"}}}let fn=!1;function Kr(){if(fn)return;const e=Gr();if(!e)return;fn=!0;const t={log:console.log.bind(console),info:console.info.bind(console),warn:console.warn.bind(console),error:console.error.bind(console)},r=(s,o)=>{try{const c=JSON.stringify({level:s,args:o.map(Yr),ts:Date.now()});fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:c,keepalive:!0}).catch(()=>{})}catch{}},n=s=>(...o)=>{r(s,o),t[s](...o)};console.log=n("log"),console.info=n("info"),console.warn=n("warn"),console.error=n("error"),typeof window<"u"&&(window.addEventListener("error",s=>{r("error",["[unhandled error]",s.message,s.filename,`${s.lineno}:${s.colno}`])}),window.addEventListener("unhandledrejection",s=>{r("error",["[unhandled rejection]",String(s.reason)])})),t.log(`[devConsole] forwarding to ${e}`)}Kr();const Vr="pronunciation_coach";(()=>{const e=globalThis,t=e.CorpanGames=e.CorpanGames||{};t[Vr]={mount:(r,n,s)=>{const o=globalThis;o.__pronunciationCoach&&(o.__pronunciationCoach.dispose(),o.__pronunciationCoach=void 0);const c=Ur(r,n),p={dispose:()=>{c.unmount()}};return o.__pronunciationCoach=p,{unmount:()=>{p.dispose(),o.__pronunciationCoach=void 0}}}}})()})();
