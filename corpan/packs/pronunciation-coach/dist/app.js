globalThis.process=globalThis.process||{env:{}};(function(){"use strict";let at=null,ot=null;const Sn=6500,Ln=8e3,$n=(e,t)=>{typeof e=="number"&&Number.isFinite(e)&&e>0&&(at=e),typeof t=="number"&&Number.isFinite(t)&&t>0&&(ot=t)},kn=()=>{if(typeof navigator>"u")return!1;const e=navigator.userAgent||"";return/iPad/.test(e)?!0:/iPhone|iPod/.test(e)?!1:!!(/Macintosh/.test(e)&&(navigator.maxTouchPoints??0)>1)},Dt=()=>at!=null&&at>=Sn||ot!=null&&ot>=Ln?!0:at==null&&ot==null?kn():!1,Ee=[{id:"tiny_proof",folder:"ggml-tiny.bin",label:"Tiny",shortDesc:"Tiny is, honestly, kind of terrible. You say 'good morning,' Tiny writes 'good warning.' Mostly useful as the baseline you compare bigger models against.",pros:["Tiniest download","Fast on every device","Works offline like everything here"],cons:["Frequently wrong on real sentences","Especially weak on non-Latin scripts"],approxSizeMB:75,defaultForFreshInstall:!0},{id:"small",folder:"ggml-small.bin",label:"Small",shortDesc:"First model that genuinely works for everyday Spanish, French, German, and friends. Boring, reasonable choice for Latin-script languages.",pros:["Solid for most European languages","Modest size and RAM use"],cons:["Less reliable than the Larges","Drifts on harder or longer sentences"],approxSizeMB:465,defaultForFreshInstall:!1},{id:"large_turbo",folder:"ggml-large-v3-turbo-q5_0.bin",label:"Large Turbo q5",shortDesc:"The smallest 'Large.' Whisper's speedy distilled decoder, weights crushed to 5 bits.",pros:["Smallest of the Large family","Snappy on iOS; the q8 variant is the equivalent pick on Android"],cons:["Slow on Android (5-bit math doesn't play well with Android CPUs — try the q8 Turbo instead)","Distilled decoder is weaker on Telugu / Tamil / other non-Latin scripts"],approxSizeMB:547,defaultForFreshInstall:!1},{id:"large_q8",folder:"ggml-large-v3-turbo-q8_0.bin",label:"Large Turbo q8",shortDesc:"Same Turbo distillation as q5, but at 8-bit precision — math most CPUs prefer. The Turbo sweet spot on Android.",pros:["~2.5× faster than q5 on Android","Better quality than q5","Works well on iOS too"],cons:["Bigger download than q5","Same Turbo weakness on non-Latin scripts"],approxSizeMB:834,defaultForFreshInstall:!1},{id:"large_qlora",folder:"ggml-large-v3-q5_0.bin",label:"Large q5",shortDesc:"Full Whisper Large brain — no Turbo distillation — compressed to 5 bits. Best in our testing for Telugu, Tamil, Bengali, and other non-Latin-script languages.",pros:["Best for Indic and other non-Latin-script languages","Keeps the full 32-layer text decoder","Honest output in the right script"],cons:["~1 GB download","Slower than Turbo on both platforms"],approxSizeMB:1031,defaultForFreshInstall:!1},{id:"medium",folder:"ggml-medium.bin",label:"Full Weight Medium",shortDesc:"Older Whisper architecture at full precision (no compression). Wins occasionally on languages later models quietly got worse at. Usually outdone by Large q5.",pros:["Every weight at native fp16 precision","Occasionally surprises on niche languages"],cons:["Bigger download than Large q5 for usually less quality","Older architecture"],approxSizeMB:1463,defaultForFreshInstall:!1},{id:"large_max",folder:"ggml-large-v3-turbo.bin",label:"Full Weight Large Turbo",shortDesc:"Whisper's speedy Turbo distillation at full 16-bit precision. Where the GPU fp16 fast path is available, it's quick despite the size.",pros:["Fastest 'Large' on iOS (Metal fp16 fast path)","Top quality for Latin-script languages"],cons:["1.5 GB download","CPU-only on Android, so slower there","Same Turbo weakness on Indic — Large q5 or q8 is better for those"],approxSizeMB:1549,defaultForFreshInstall:!1},{id:"large_q8_full",folder:"ggml-large-v3-q8_0.bin",label:"Large q8 ★",shortDesc:"The biggest, baddest model that still fits in app memory — full Whisper Large at 8-bit precision (we quantize this one ourselves from the original fp16, since upstream doesn't ship it). Should be the new best for Indic and other non-Latin-script languages.",pros:["Higher precision than Large q5, same full 32-layer decoder","Expected best quality for Telugu, Tamil, Bengali, etc."],cons:["~1.6 GB download","Slower than Turbo and a bit slower than Large q5","Needs ~3 GB RAM headroom during first transcribe"],approxSizeMB:1580,defaultForFreshInstall:!1,requiresLargeMemory:!0,downloadUrl:"https://d38iwc9748jekz.cloudfront.net/whisper-models/ggml-large-v3-q8_0.bin"}],$t=()=>Dt()?Ee:Ee.filter(e=>!e.requiresLargeMemory),Mn=()=>{const e=$t();return e.find(t=>t.defaultForFreshInstall)??e[0]},Tn=e=>!!e.requiresLargeMemory&&!Dt(),ue=e=>{if(e)return Ee.find(t=>t.id===e)},Ft=()=>Ee.find(e=>e.defaultForFreshInstall)??Ee[0],Pe={temperature:0,temperature_inc:.2,entropy_thold:2.4,logprob_thold:-1,no_speech_thold:.6,suppress_blank:!0,suppress_nst:!1,n_threads:0,initial_prompt:""},st={te:{temperature_inc:0,initial_prompt:"నేను తెలుగు నేర్చుకుంటున్నాను. నేను ఒక పదబంధం ప్రయత్నిస్తాను, మీరు విన్నది నిజాయితీగా చెప్పండి."},ta:{temperature_inc:0,initial_prompt:"நான் தமிழ் கற்றுக்கொள்கிறேன். ஒரு சொற்றொடரை முயற்சிக்கப் போகிறேன், நீங்கள் கேட்டதை நேர்மையாகச் சொல்லுங்கள்."},ml:{temperature_inc:0,initial_prompt:"ഞാൻ മലയാളം പഠിക്കുകയാണ്. ഞാൻ ഒരു വാക്യം പറയാൻ പോകുന്നു, നിങ്ങൾ കേട്ടത് സത്യസന്ധമായി പറയൂ."},bn:{temperature_inc:0,initial_prompt:"আমি বাংলা শিখছি। আমি একটি বাক্যাংশ চেষ্টা করব, আপনি যা শুনেছেন তা সততার সাথে বলুন।"},mr:{temperature_inc:0,initial_prompt:"मी मराठी शिकत आहे. मी एक वाक्यांश प्रयत्न करणार आहे, तुम्ही ऐकलेले प्रामाणिकपणे सांगा."},gu:{temperature_inc:0,initial_prompt:"હું ગુજરાતી શીખું છું. હું એક વાક્ય બોલવાનો છું, તમે જે સાંભળ્યું તે પ્રામાણિકતાથી કહો."},pa:{temperature_inc:0,initial_prompt:"ਮੈਂ ਪੰਜਾਬੀ ਸਿੱਖ ਰਿਹਾ ਹਾਂ। ਮੈਂ ਇੱਕ ਵਾਕੰਸ਼ ਅਜ਼ਮਾਉਣ ਜਾ ਰਿਹਾ ਹਾਂ, ਤੁਸੀਂ ਜੋ ਸੁਣਿਆ ਉਹ ਇਮਾਨਦਾਰੀ ਨਾਲ ਦੱਸੋ।"},or:{temperature_inc:0,initial_prompt:"ମୁଁ ଓଡ଼ିଆ ଶିଖୁଛି। ମୁଁ ଗୋଟିଏ ଶବ୍ଦଗୁଚ୍ଛ ଚେଷ୍ଟା କରିବି, ଆପଣ ଯାହା ଶୁଣିଲେ ସତ୍ୟ ଭାବରେ କୁହନ୍ତୁ।"},as:{temperature_inc:0,initial_prompt:"মই অসমীয়া শিকি আছোঁ। মই এটা বাক্যাংশ চেষ্টা কৰিম, আপুনি যি শুনিলে সেইটো সত্যনিষ্ঠভাৱে কওক।"},ne:{temperature_inc:0,initial_prompt:"म नेपाली सिक्दैछु। म एउटा वाक्यांश प्रयास गर्ने छु, तपाईंले सुनेको कुरा इमानदारीपूर्वक भन्नुहोस्।"},si:{temperature_inc:0,initial_prompt:"මම සිංහල ඉගෙන ගන්නවා. මම වාක්‍ය ඛණ්ඩයක් උත්සාහ කරන්නම්, ඔබ ඇසූදේ අවංකව කියන්න."},fa:{temperature_inc:0,initial_prompt:"من فارسی یاد می‌گیرم. می‌خواهم یک عبارت بگویم، آنچه شنیدید را صادقانه بگویید."},ur:{temperature_inc:0,initial_prompt:"میں اردو سیکھ رہا ہوں۔ میں ایک جملہ بولنے جا رہا ہوں، جو آپ نے سنا اسے دیانتداری سے بتائیں۔"}},Ut="pc:whisper-tuning",xe=()=>{try{const e=localStorage.getItem(Ut);if(!e)return{};const t=JSON.parse(e);return!t||typeof t!="object"?{}:t}catch(e){return console.error("[whisperTuning] loadUserOverrides failed:",e),{}}},kt=e=>{try{localStorage.setItem(Ut,JSON.stringify(e))}catch(t){console.error("[whisperTuning] saveUserOverrides failed:",t)}},Mt=(e,t)=>{const r=xe(),n=e.split("-")[0].toLowerCase(),o={...r[n]??{},...t};for(const c of Object.keys(o))o[c]===void 0&&delete o[c];Object.keys(o).length===0?delete r[n]:r[n]=o,kt(r)},En=e=>{const t=xe(),r=e.split("-")[0].toLowerCase();delete t[r],kt(t)},xn=()=>{kt({})},Wt=e=>{const t=e.split("-")[0].toLowerCase(),r=st[t]??{},n=xe()[t]??{};return{...r,...n}},it=[{key:"temperature_inc",label:"temperature_inc",min:0,max:.5,step:.05,help:"Step for the fallback ladder (0.0 → 0.2 → 0.4 → … → 1.0). 0.0 disables retries entirely — one greedy decode, deterministic."},{key:"temperature",label:"temperature",min:0,max:1.5,step:.05,help:"Initial decoding temperature. 0.0 = greedy. Raise to sample from the start (almost never want for transcription)."},{key:"entropy_thold",label:"entropy_thold",min:0,max:10,step:.1,help:"Compression-ratio-style quality gate. Higher = more permissive. Indic BPE routinely exceeds 2.4 default."},{key:"logprob_thold",label:"logprob_thold",min:-5,max:0,step:.1,help:"Avg per-token log-prob below which the decode is flagged unconfident and the fallback fires."},{key:"no_speech_thold",label:"no_speech_thold",min:0,max:1,step:.05,help:"Whisper's posterior threshold for 'this segment is silence.' Above this, the segment emits nothing."},{key:"n_threads",label:"n_threads",min:0,max:12,step:1,help:"CPU thread count. 0 = let the plugin decide (cores − 2). Higher uses more battery; lower can free the UI thread."}],ct=[{key:"suppress_blank",label:"suppress_blank",help:"Suppress blank tokens at the start of a segment."},{key:"suppress_nst",label:"suppress_nst",help:"Suppress non-speech tokens (music, noise markers). False by default."}],lt=[{key:"initial_prompt",label:"initial_prompt",placeholder:"(empty)",help:"Up to ~224 tokens prepended before decoding. Bias toward a script/language; do NOT leak the expected phrase (model will parrot it). Native-script primer recommended for Indic langs."}],_n=e=>e.split("-")[0].toLowerCase(),Se=(e,t)=>t>=1?String(Math.round(e)):t>=.1?e.toFixed(1):e.toFixed(2),We=e=>e.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;");let le=null,me="";const Cn=e=>{var i,o,c,u,h;le&&je(),me=_n(e);const t=document.createElement("div");t.className="pc-tuner-root",t.innerHTML=Rn(me),document.body.appendChild(t),requestAnimationFrame(()=>{t.classList.add("open")}),(i=t.querySelector("[data-pc-tuner-backdrop]"))==null||i.addEventListener("click",je),(o=t.querySelector("[data-pc-tuner-close]"))==null||o.addEventListener("click",je);const r=t.querySelector("[data-pc-tuner-handle]"),n=t.querySelector(".pc-tuner-sheet");if(r&&n){let v=0,w=0,D=!1;const m=6;r.addEventListener("pointerdown",S=>{D=!0,v=S.clientY,w=Date.now(),r.setPointerCapture(S.pointerId),n.style.transition="none"}),r.addEventListener("pointermove",S=>{if(!D)return;const F=Math.max(0,S.clientY-v);n.style.transform=`translateY(${F}px)`});const y=(S,F)=>{if(!D)return;D=!1;try{r.releasePointerCapture(S.pointerId)}catch{}const b=S.clientY-v,q=Date.now()-w,ke=q>0?b/q:0,g=n.offsetHeight*.15,$=F&&(b>g||ke>.5&&b>20||Math.abs(b)<m);n.style.transition="",n.style.transform="",$&&je()};r.addEventListener("pointerup",S=>y(S,!0)),r.addEventListener("pointercancel",S=>y(S,!1))}t.addEventListener("keydown",v=>{v.key==="Escape"&&je()});for(const v of it)An(t,v);for(const v of ct)On(t,v);for(const v of lt)Nn(t,v);(c=t.querySelector("[data-pc-tuner-copy]"))==null||c.addEventListener("click",zn),(u=t.querySelector("[data-pc-tuner-reset-lang]"))==null||u.addEventListener("click",Hn),(h=t.querySelector("[data-pc-tuner-reset-all]"))==null||h.addEventListener("click",Bn),le=t},je=()=>{if(!le)return;const e=le;le=null,e.classList.remove("open"),window.setTimeout(()=>{e.parentNode&&e.parentNode.removeChild(e)},240)},Rn=e=>{const t=st[e]??{},r=xe()[e]??{},n=it.map(c=>qn(c,t,r)).join(""),i=ct.map(c=>In(c,t,r)).join(""),o=lt.map(c=>Pn(c,t,r)).join("");return`
    <div class="pc-tuner-backdrop" data-pc-tuner-backdrop></div>
    <div class="pc-tuner-sheet" role="dialog" aria-label="Whisper tuning">
      <div class="pc-tuner-handle" data-pc-tuner-handle
           role="button" aria-label="Close tuner" tabindex="0">
        <div class="pc-tuner-handle-bar"></div>
      </div>
      <header class="pc-tuner-head">
        <div class="pc-tuner-title">
          <span class="pc-tuner-eyebrow">whisper tuning</span>
          <span class="pc-tuner-lang">${We(e.toUpperCase())}</span>
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
          ${i}
        </div>
      </div>
      <footer class="pc-tuner-foot">
        <button class="pc-tuner-btn" data-pc-tuner-copy>Copy as JSON</button>
        <button class="pc-tuner-btn" data-pc-tuner-reset-lang>Reset this lang</button>
        <button class="pc-tuner-btn danger" data-pc-tuner-reset-all>Reset all</button>
        <button class="pc-tuner-btn primary" data-pc-tuner-close>Done</button>
      </footer>
    </div>
  `},qn=(e,t,r)=>{const n=Pe[e.key]??0,i=t[e.key],o=r[e.key],c=o!==void 0?o:i!==void 0?i:n,u=o!==void 0&&o!==n,h=[];return h.push(`<span>default <b>${Se(n,e.step)}</b></span>`),i!==void 0&&h.push(`<span>built-in <b>${Se(i,e.step)}</b></span>`),u&&h.push('<span class="pc-tuner-modified">modified</span>'),`
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
               value="${Se(c,e.step)}"
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
        ${h.join('<span class="pc-tuner-sep">·</span>')}
      </div>
      <p class="pc-tuner-help">${e.help}</p>
    </div>
  `},In=(e,t,r)=>{const n=Pe[e.key],i=t[e.key],o=r[e.key],c=o!==void 0?o:i!==void 0?i:n,u=o!==void 0&&o!==n;return`
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
        ${i!==void 0?`<span class="pc-tuner-sep">·</span>
               <span>built-in <b>${i?"on":"off"}</b></span>`:""}
        ${u?`<span class="pc-tuner-sep">·</span>
               <span class="pc-tuner-modified">modified</span>`:""}
      </div>
      <p class="pc-tuner-help">${e.help}</p>
    </div>
  `},Pn=(e,t,r)=>{const n=t[e.key],i=r[e.key],o=i!==void 0?i:n!==void 0?n:"",c=i!==void 0&&i!==(n??""),u=[];return n&&n.length>0?u.push(`<span>built-in <b>"${We(n)}"</b></span>`):u.push("<span>default <b>(empty)</b></span>"),c&&u.push('<span class="pc-tuner-modified">modified</span>'),`
    <div class="pc-tuner-row pc-tuner-row-text" data-pc-row="${e.key}">
      <div class="pc-tuner-row-head">
        <label class="pc-tuner-row-label" for="pc-tuner-text-${e.key}">
          ${e.label}
        </label>
      </div>
      <textarea id="pc-tuner-text-${e.key}"
                class="pc-tuner-text"
                rows="2"
                placeholder="${We(e.placeholder)}"
                data-pc-tuner-text="${e.key}"
                spellcheck="false"
                autocapitalize="off"
                autocorrect="off">${We(o)}</textarea>
      <div class="pc-tuner-row-trail">
        ${u.join('<span class="pc-tuner-sep">·</span>')}
      </div>
      <p class="pc-tuner-help">${e.help}</p>
    </div>
  `},An=(e,t)=>{const r=e.querySelector(`[data-pc-tuner-slider="${t.key}"]`),n=e.querySelector(`[data-pc-tuner-num="${t.key}"]`);if(!r||!n)return;const i=o=>{const c=parseFloat(o);if(Number.isNaN(c))return;const u=Math.min(t.max,Math.max(t.min,c));Mt(me,{[t.key]:u}),r.value=String(u),n.value=Se(u,t.step),Ae(e,t.key)};r.addEventListener("input",()=>{n.value=Se(parseFloat(r.value),t.step)}),r.addEventListener("change",()=>i(r.value)),n.addEventListener("change",()=>i(n.value))},On=(e,t)=>{const r=e.querySelector(`[data-pc-tuner-bool="${t.key}"]`);r&&r.addEventListener("change",()=>{Mt(me,{[t.key]:r.checked}),Ae(e,t.key)})},Nn=(e,t)=>{const r=e.querySelector(`[data-pc-tuner-text="${t.key}"]`);if(!r)return;const n=()=>{const i=r.value;Mt(me,{[t.key]:i.length>0?i:void 0}),Ae(e,t.key)};r.addEventListener("blur",n),r.addEventListener("keydown",i=>{i.key==="Enter"&&!(i.metaKey||i.ctrlKey||i.shiftKey)&&(i.preventDefault(),r.blur())})},Ae=(e,t)=>{const r=st[me]??{},n=xe()[me]??{},i=e.querySelector(`[data-pc-row="${t}"]`);if(!i)return;const o=i.querySelector(".pc-tuner-row-trail");if(!o)return;const c=it.find(v=>v.key===t);if(c){const v=Pe[t]??0,w=r[t],D=n[t],m=D!==void 0&&D!==v,y=[`<span>default <b>${Se(v,c.step)}</b></span>`];w!==void 0&&y.push(`<span>built-in <b>${Se(w,c.step)}</b></span>`),m&&y.push('<span class="pc-tuner-modified">modified</span>'),o.innerHTML=y.join('<span class="pc-tuner-sep">·</span>');return}if(ct.find(v=>v.key===t)){const v=Pe[t],w=r[t],D=n[t],m=D!==void 0&&D!==v,y=[`<span>default <b>${v?"on":"off"}</b></span>`];w!==void 0&&y.push(`<span>built-in <b>${w?"on":"off"}</b></span>`),m&&y.push('<span class="pc-tuner-modified">modified</span>'),o.innerHTML=y.join('<span class="pc-tuner-sep">·</span>');return}if(lt.find(v=>v.key===t)){const v=r[t],w=n[t],D=w!==void 0&&w!==(v??""),m=[];v&&v.length>0?m.push(`<span>built-in <b>"${We(v)}"</b></span>`):m.push("<span>default <b>(empty)</b></span>"),D&&m.push('<span class="pc-tuner-modified">modified</span>'),o.innerHTML=m.join('<span class="pc-tuner-sep">·</span>')}},zn=async()=>{var t;const e=JSON.stringify(xe(),null,2);try{await((t=navigator.clipboard)==null?void 0:t.writeText(e)),dt(`Copied (${e.length} chars)`)}catch(r){console.error("[whisperTunerUI] clipboard write failed:",r),dt("Copy failed — see console")}},jt=e=>{const t=st[me]??{},r=xe()[me]??{};for(const n of it){const i=Pe[n.key]??0,o=r[n.key]!==void 0?r[n.key]:t[n.key]!==void 0?t[n.key]:i,c=e.querySelector(`[data-pc-tuner-slider="${n.key}"]`),u=e.querySelector(`[data-pc-tuner-num="${n.key}"]`);c&&(c.value=String(o)),u&&(u.value=Se(o,n.step)),Ae(e,n.key)}for(const n of ct){const i=Pe[n.key],o=r[n.key]!==void 0?r[n.key]:t[n.key]!==void 0?t[n.key]:i,c=e.querySelector(`[data-pc-tuner-bool="${n.key}"]`);c&&(c.checked=o),Ae(e,n.key)}for(const n of lt){const i=r[n.key]!==void 0?r[n.key]:t[n.key]!==void 0?t[n.key]:"",o=e.querySelector(`[data-pc-tuner-text="${n.key}"]`);o&&(o.value=i),Ae(e,n.key)}},Hn=()=>{le&&(En(me),jt(le),dt("Reset to built-in"))},Bn=()=>{le&&(xn(),jt(le),dt("All languages reset"))},dt=e=>{if(!le)return;const t=le.querySelector(".pc-tuner-foot");if(!t)return;const r=document.createElement("div");r.className="pc-tuner-flash",r.textContent=e,t.appendChild(r),window.setTimeout(()=>{r.parentNode&&r.parentNode.removeChild(r)},1600)},pt=e=>{if(e&&typeof e=="object"){const t=e.code;if(typeof t=="string")return t}},fe=e=>{if(e==null)return"(unknown error)";if(typeof e=="string")return e;if(e instanceof Error)return e.message||e.name||String(e);if(typeof e=="object"){const t=e,r=[t.message,t.localizedDescription,t.error,t.description,t.detail];for(const n of r)if(typeof n=="string"&&n.length>0)return n;try{const n=JSON.stringify(e);if(n&&n!=="{}")return n}catch{}}return String(e)},Dn=70,Fn=.4,Tt="corpan-pronunciation-coach:v2",Gt="corpan-pronunciation-coach:v1",Un=50,Le=e=>{var t;return((t=ue(e))==null?void 0:t.folder)??e},Q=e=>{var t;return((t=ue(e))==null?void 0:t.label)??e},Wn=e=>{const t=ue(e);return t&&t.approxSizeMB>=1e3?18e4:6e4},jn=9e4,Yt=async(e,t,r)=>{let n=null;const i=new Promise((o,c)=>{n=setTimeout(()=>{c(new Error(`${r} timed out after ${Math.round(t/1e3)}s`))},t)});try{return await Promise.race([e,i])}finally{n&&clearTimeout(n)}},Gn=e=>{var t,r,n;return{entryId:e.entry.entry_id,level:e.entry.level,domains:e.entry.domains??[],targetLang:e.targetLang,targetText:e.target.text,targetRoman:e.target.romanization??"",nativeLang:((t=e.native)==null?void 0:t.language_code)??null,nativeText:((r=e.native)==null?void 0:r.text)??"",nativeRoman:((n=e.native)==null?void 0:n.romanization)??""}},Yn=e=>({entry:{entry_id:e.entryId,level:e.level,domains:e.domains,translations:[]},target:{language_code:e.targetLang,text:e.targetText,romanization:e.targetRoman},native:e.nativeLang?{language_code:e.nativeLang,text:e.nativeText,romanization:e.nativeRoman}:null,targetLang:e.targetLang}),Kt=/[''']/,Kn={en:{zero:"0",one:"1",two:"2",three:"3",four:"4",five:"5",six:"6",seven:"7",eight:"8",nine:"9",ten:"10",eleven:"11",twelve:"12",thirteen:"13",fourteen:"14",fifteen:"15",sixteen:"16",seventeen:"17",eighteen:"18",nineteen:"19",twenty:"20",thirty:"30",forty:"40",fifty:"50",sixty:"60",seventy:"70",eighty:"80",ninety:"90",hundred:"100",thousand:"1000"},es:{cero:"0",uno:"1",una:"1",dos:"2",tres:"3",cuatro:"4",cinco:"5",seis:"6",siete:"7",ocho:"8",nueve:"9",diez:"10",once:"11",doce:"12",trece:"13",catorce:"14",quince:"15",dieciséis:"16",dieciseis:"16",diecisiete:"17",dieciocho:"18",diecinueve:"19",veinte:"20",treinta:"30",cuarenta:"40",cincuenta:"50",sesenta:"60",setenta:"70",ochenta:"80",noventa:"90",cien:"100",ciento:"100",mil:"1000"},fr:{zéro:"0",zero:"0",un:"1",une:"1",deux:"2",trois:"3",quatre:"4",cinq:"5",six:"6",sept:"7",huit:"8",neuf:"9",dix:"10",onze:"11",douze:"12",treize:"13",quatorze:"14",quinze:"15",seize:"16",vingt:"20",trente:"30",quarante:"40",cinquante:"50",soixante:"60",cent:"100",mille:"1000"},it:{zero:"0",uno:"1",una:"1",due:"2",tre:"3",quattro:"4",cinque:"5",sei:"6",sette:"7",otto:"8",nove:"9",dieci:"10",undici:"11",dodici:"12",tredici:"13",quattordici:"14",quindici:"15",sedici:"16",diciassette:"17",diciotto:"18",diciannove:"19",venti:"20",trenta:"30",quaranta:"40",cinquanta:"50",sessanta:"60",settanta:"70",ottanta:"80",novanta:"90",cento:"100",mille:"1000"},de:{null:"0",eins:"1",ein:"1",eine:"1",zwei:"2",drei:"3",vier:"4",fünf:"5",funf:"5",sechs:"6",sieben:"7",acht:"8",neun:"9",zehn:"10",elf:"11",zwölf:"12",zwolf:"12",dreizehn:"13",vierzehn:"14",fünfzehn:"15",funfzehn:"15",sechzehn:"16",siebzehn:"17",achtzehn:"18",neunzehn:"19",zwanzig:"20",dreißig:"30",dreissig:"30",vierzig:"40",fünfzig:"50",funfzig:"50",sechzig:"60",siebzig:"70",achtzig:"80",neunzig:"90",hundert:"100",tausend:"1000"},pt:{zero:"0",um:"1",uma:"1",dois:"2",duas:"2",três:"3",tres:"3",quatro:"4",cinco:"5",seis:"6",sete:"7",oito:"8",nove:"9",dez:"10",onze:"11",doze:"12",treze:"13",catorze:"14",quatorze:"14",quinze:"15",dezesseis:"16",dezasseis:"16",dezessete:"17",dezassete:"17",dezoito:"18",dezenove:"19",dezanove:"19",vinte:"20",trinta:"30",quarenta:"40",cinquenta:"50",sessenta:"60",setenta:"70",oitenta:"80",noventa:"90",cem:"100",cento:"100",mil:"1000"}},Vn=new Set(["te","ta","bn","ml","mr","gu","pa","ur","fa","si","ne","or","as"]),Xn=new Set(["ar","he","fa","ur"]),Qn=new Set(["pa-arab"]),Vt=e=>{if(!e)return!1;const t=e.toLowerCase();return Qn.has(t)?!0:Xn.has(t.split("-")[0])},$e=(e,t)=>{const r=e.normalize("NFC").toLowerCase().replace(/[\p{P}\p{S}\p{C}]/gu,"").replace(/\s+/g," ").trim();if(!r)return r;const n=(t??"").toLowerCase().split("-")[0],i=Kn[n];return i?r.split(" ").map(o=>i[o]??o).join(" "):r},Jn=/[぀-ゟ゠-ヿ㐀-䶿一-鿿豈-﫿가-힯]/,ut=e=>{const t=e.trim();if(!t)return[];if(/\s/.test(t))return t.split(/\s+/).filter(Boolean);if(Jn.test(t)){const r=Intl.Segmenter;if(typeof r=="function"){const n=new r(void 0,{granularity:"grapheme"});return Array.from(n.segment(t),i=>i.segment).filter(i=>i.trim().length>0)}return Array.from(t).filter(n=>n.trim().length>0)}return[t]},mt=(e,t)=>{const r=Array.from(e),n=Array.from(t),i=r.length,o=n.length;if(i===0&&o===0)return 1;if(i===0||o===0)return 0;let c=new Array(o+1),u=new Array(o+1);for(let h=0;h<=o;h++)c[h]=h;for(let h=1;h<=i;h++){u[0]=h;for(let w=1;w<=o;w++)u[w]=r[h-1]===n[w-1]?c[w-1]:1+Math.min(c[w],u[w-1],c[w-1]);const v=c;c=u,u=v}return 1-c[o]/Math.max(i,o)},Xt=e=>{if(!e||e.length===0)return[];const t=[];for(const r of e){const n=t[t.length-1];if(n){const i=n.word.replace(/\s+$/,"").slice(-1),o=r.word.replace(/^\s+/,"").charAt(0),c=Kt.test(i),u=Kt.test(o);if(c||u){n.word=n.word+r.word.replace(/^\s+/,""),n.endMs=Math.max(n.endMs,r.endMs),n.probability=Math.min(n.probability,r.probability);continue}}t.push({...r})}return t},Zn=()=>{try{const e=window.localStorage,t="__pc_probe__";return e.setItem(t,"1"),e.removeItem(t),e}catch{return null}},Qt=e=>{if(!e)return null;try{const t=JSON.parse(e);return typeof t!="object"||t===null||!Array.isArray(t.phrases)||typeof t.idx!="number"||typeof t.streak!="number"?null:t}catch(t){return console.error("[pronunciation-coach] localStorage parse failed:",t),null}},Jt=e=>{if(!e)return null;const t=Qt(e.getItem(Tt));if(t)return t;const r=Qt(e.getItem(Gt));if(!r)return null;const n={...r,mode:r.mode==="standard"?"standard":void 0};try{e.setItem(Tt,JSON.stringify(n)),e.removeItem(Gt),console.log("[pronunciation-coach] migrated v1 → v2 storage, mode preserved:",n.mode??"(cleared)")}catch(i){console.error("[pronunciation-coach] storage migration failed:",i)}return n},er=()=>{try{const e=globalThis.crypto;if(e&&typeof e.randomUUID=="function")return e.randomUUID()}catch(e){console.error("[pronunciation-coach] randomUUID failed:",e)}return`pc-${Date.now()}-${Math.floor(Math.random()*1e9)}`},Zt=e=>e?e.split("-")[0].toLowerCase():"en",tr=e=>{const t=[...e];for(let r=t.length-1;r>0;r--){const n=Math.floor(Math.random()*(r+1));[t[r],t[n]]=[t[n],t[r]]}return t},nr=(e,t)=>{const r=t.length>0?e.translations.find(o=>o.language_code===t[0])??null:null;let n=null;const i=tr(t.slice(1));for(const o of i){const c=e.translations.find(u=>u.language_code===o);if(c){n=c;break}}return n||(n=e.translations.find(o=>!r||o.language_code!==r.language_code)??null),{target:n,native:r}},J=e=>e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"),ft=()=>{try{window.dispatchEvent(new CustomEvent("corpan:exit"))}catch(e){console.error("[pronunciation-coach] dispatch exit failed:",e)}},rr=e=>{const t=document.createElement("div");t.className="pc-confetti";const r=["#7c3aed","#16a34a","#facc15","#ec4899","#06b6d4"],n=32;for(let i=0;i<n;i++){const o=document.createElement("span");o.style.left=`${Math.random()*100}%`,o.style.background=r[i%r.length],o.style.animationDelay=`${Math.random()*200}ms`,o.style.animationDuration=`${900+Math.random()*600}ms`,o.style.transform=`rotate(${Math.random()*360}deg)`,t.appendChild(o)}e.appendChild(t),window.setTimeout(()=>t.remove(),1800)},ar=(e,t,r)=>{const n=t.stt;let i=!1,o=null;const c=document.querySelector('meta[name="viewport"]'),u=(c==null?void 0:c.getAttribute("content"))??null;c&&c.setAttribute("content","width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover");const h=()=>{c&&u!==null&&c.setAttribute("content",u)},v=(a="Speech recognition isn't available on this device",s="Parlometron needs the on-device Whisper plugin and didn't find a working one here. Try updating the app, or this platform may not be supported yet.")=>{var l;e.innerHTML=`
      <div class="pc-root">
        <div class="pc-header">
          <div class="pc-header-left"></div>
          <div class="pc-header-right">
            <button class="pc-close" id="pc-close" type="button" aria-label="Close">×</button>
          </div>
        </div>
        <div class="pc-unavailable">
          <h2>${J(a)}</h2>
          <p>${J(s)}</p>
        </div>
      </div>
    `,(l=e.querySelector("#pc-close"))==null||l.addEventListener("click",ft)};if(!n)return v(),{unmount:()=>{h(),e.innerHTML=""}};e.innerHTML=`
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
  `;const w=e.querySelector("#pc-close"),D=e.querySelector("#pc-streak"),m=e.querySelector("#pc-streak-n"),y=e.querySelector("#pc-mode"),S=e.querySelector("#pc-swipe-area"),F=e.querySelector("#pc-deck");let b=e.querySelector("#pc-card");const q=e.querySelector("#pc-mic"),ke=e.querySelector("#pc-mic-icon"),g=e.querySelector("#pc-mic-label"),$=a=>a.querySelector("[data-pc-result-banner]"),C=a=>a.querySelector("[data-pc-result-transcript-up]"),H=a=>a.querySelector("[data-pc-result-bars-up]"),ne=a=>a.querySelector("[data-pc-result-detail]"),B=e.querySelector("#pc-error");let N=null;const Y=(a,s)=>{N||(N=document.createElement("div"),N.className="pc-overlay",N.innerHTML=`
        <div class="pc-spinner"></div>
        <div id="pc-overlay-msg"></div>
        <button id="pc-overlay-cancel" type="button" hidden></button>`,document.body.appendChild(N));const l=N.querySelector("#pc-overlay-msg");l&&(l.textContent=a);const d=N.querySelector("#pc-overlay-cancel");d&&(s!=null&&s.cancelLabel&&s.onCancel?(d.textContent=s.cancelLabel,d.hidden=!1,d.onclick=s.onCancel):(d.hidden=!0,d.onclick=null))},j=()=>{N&&N.parentNode&&N.parentNode.removeChild(N),N=null},I=a=>{B.textContent=a,B.hidden=!1,console.error("[pronunciation-coach]",a)},he=()=>{B.textContent="",B.hidden=!0};let ee="idle",P=!1,M=null;const K=[];let U=-1,ge=null,ce=0,x=Ft().id,oe=!1;const de=Zn(),Me=()=>{if(de)try{const a=Math.max(0,K.length-Un),s=K.slice(a).map(Gn),l=U-a,d={streak:ce,phrases:s,idx:l,mode:x};de.setItem(Tt,JSON.stringify(d))}catch(a){console.error("[pronunciation-coach] persist failed:",a)}},Oe=()=>{const a=ue(x);y.setAttribute("aria-pressed",x==="advanced"?"true":"false"),y.classList.toggle("advanced",x==="advanced"),y.disabled=oe;const s=a?`${a.label} model (~${a.approxSizeMB} MB) · tap to switch`:`${Q(x)} model · tap to switch`;y.title=s,y.setAttribute("aria-label",`Speech model: ${Q(x)}`);const l=e.querySelector("#pc-footer-model");l&&(l.textContent=Q(x))},Ve=()=>{ce<=0?D.hidden=!0:(m.textContent=String(ce),D.hidden=!1)},Z=a=>{ee=a,q.classList.remove("recording","scoring"),q.disabled=!1,a==="idle"?(ke.innerHTML="●",g.textContent=P?"Tap to speak":"Loading model…",q.disabled=!P||!M):a==="recording"?(q.classList.add("recording"),ke.innerHTML="■",g.textContent="Listening… tap to stop"):a==="scoring"&&(q.classList.add("scoring"),ke.innerHTML='<div class="pc-spinner"></div>',g.textContent="Scoring…",q.disabled=!0)},Ne=(a,s,l)=>`
    <div class="pc-card-above">
      <div class="pc-result-banner" data-pc-result-banner hidden></div>
      <div class="pc-result-transcript-up" data-pc-result-transcript-up hidden></div>
      <div class="pc-result-bars-up" data-pc-result-bars-up hidden></div>
    </div>
    <div class="pc-card-center">
      ${a}
      ${s}
      ${l}
    </div>
    <div class="pc-card-below">
      <div class="pc-result-detail" data-pc-result-detail hidden></div>
    </div>
  `,be=e.querySelector("#pc-lang-badge"),Xe=a=>{if(!a){be.hidden=!0,be.textContent="—",be.setAttribute("data-pc-lang","");return}const s=Zt(a);be.hidden=!1,be.textContent=s.toUpperCase(),be.setAttribute("data-pc-lang",s),be.setAttribute("aria-label",`Target language ${s.toUpperCase()} — long-press to tune Whisper`)},z=(a,s)=>{var T;const d=!!t.getStackConfig().showRomanization,f=s.target.romanization||"",k=d&&f?`<p class="pc-romanization">${J(f)}</p>`:"",A=(T=s.native)!=null&&T.text?`<p class="pc-native">${J(s.native.text)}</p>`:"";a.innerHTML=Ne(`<h1 class="pc-target">${J(s.target.text||"—")}</h1>`,k,A),Xe(s.targetLang)},W=(a,s,l)=>{a.innerHTML=Ne(`<h1 class="pc-target">${J(s)}</h1>`,"",`<p class="pc-native">${J(l)}</p>`),Xe(null)},se=()=>{M&&z(b,M)},ze=async(a,s)=>{const l=F.clientWidth||window.innerWidth,d=a==="left"?-1:1;b.style.transition="transform 220ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 200ms ease",b.style.transform=`translateX(${d*l}px)`,b.style.opacity="0",await new Promise(k=>window.setTimeout(k,220));const f=document.createElement("div");f.className="pc-card entering",f.id="pc-card",f.style.transition="none",f.style.transform=`translateX(${-d*l}px)`,f.style.opacity="0",s(f),F.replaceChild(f,b),b=f,b.offsetWidth,b.style.transition="transform 280ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity 240ms ease",b.style.transform="translateX(0)",b.style.opacity="1",b.classList.remove("entering"),b.classList.add("entered")},He=async()=>{const a=t.getStackConfig();if(!a.languages||a.languages.length<2||!t.getRandomEntry)return null;const s=await t.getRandomEntry(),{target:l,native:d}=nr(s,a.languages);return l?{entry:s,target:l,native:d,targetLang:l.language_code}:null},we=()=>{ge||i||He().then(a=>{!i&&a&&(ge=a)}).catch(a=>{console.error("[pronunciation-coach] prefetch failed:",a)})},yt=async()=>{if(ee==="scoring")return;Qe(),he();const a=t.getStackConfig();if(!a.languages||a.languages.length<2){M=null,W(b,"Set up at least one target language","Open Corpán settings and add a target language to start practising."),q.disabled=!0,g.textContent="—";return}if(U>=0&&U<K.length-1){const l=K[U+1];U+=1,await ze("left",d=>z(d,l)),M=l,Z("idle"),Me();return}let s=ge;if(ge=null,!s)try{s=await He()}catch(l){console.error("[pronunciation-coach] fetch next failed:",l),I(`Could not load a phrase: ${fe(l)}`);return}if(!s){I("No phrases available — check your stack config.");return}K.push(s),U=K.length-1,await ze("left",l=>z(l,s)),M=s,Z("idle"),Me(),we()},on=async()=>{if(ee==="scoring"||U<=0)return;Qe(),he();const a=K[U-1];U-=1,await ze("right",s=>z(s,a)),M=a,Z("idle"),Me()},Or=a=>{const s=$(a),l=C(a),d=H(a),f=ne(a),k=()=>{s&&(s.innerHTML="",s.hidden=!0,s.className="pc-result-banner"),l&&(l.innerHTML="",l.hidden=!0,l.className="pc-result-transcript-up"),d&&(d.innerHTML="",d.hidden=!0,d.className="pc-result-bars-up"),f&&(f.innerHTML="",f.hidden=!0,f.className="pc-result-detail")};if(!(s&&!s.hidden||l&&!l.hidden||d&&!d.hidden||f&&!f.hidden)){k();return}s&&!s.hidden&&s.classList.add("leaving"),l&&!l.hidden&&l.classList.add("leaving"),d&&!d.hidden&&d.classList.add("leaving"),f&&!f.hidden&&f.classList.add("leaving"),window.setTimeout(k,220)},Nr=()=>Or(b),zr=a=>{const s=Math.max(0,Math.min(1,a.overallScore)),l=Math.max(0,Math.min(1,a.noSpeechProb??0)),d=a.compressionRatio??0,f=Math.max(0,Math.min(1,a.freeVsConstrainedSimilarity??1)),k=O=>`${Math.round(O*100)}%`,A=l>.5;let T="bad",_="Try again";A?(T="bad",_="🎙️ Couldn't hear you"):s>=.95?(T="good",_="✨ Perfect!"):s>=.85?(T="good",_="🎉 Nailed it!"):s>=.75?(T="good",_="Great"):s>=.6?(T="okay",_="Pretty good"):s>=.45?(T="okay",_="Close — keep going"):s>=.25&&(T="bad",_="Keep practicing"),A||(s>=.85?(ce+=1,rr(document.body)):s>=.6||(ce=0)),Ve(),Me();const V=Xt(a.words||[]),L=((M==null?void 0:M.target.text)||"").trim(),re=ut(L),ye=(a.freeText||"").trim(),St=ut(ye),Lt=re.length>0&&re.length===V.length,nt=re.length>0&&re.length===St.length,p=L.length>0&&ye.length===0,E=(M==null?void 0:M.targetLang)||a.language||"",G=ye.length&&L.length?mt($e(ye,E),$e(L,E)):p?0:null,R=re.length?re.map((O,X)=>({word:O,heardProb:Lt?V[X].probability:null,freeSim:nt?mt($e(O,E),$e(St[X],E)):G})):L?[{word:L,heardProb:null,freeSim:G}]:[],ae=O=>O===null?null:O>=.9?"good":O>=.6?"okay":"bad",te=O=>O===null?null:O>=.85?"good":O>=.6?"okay":"bad",ve={bad:0,okay:1,good:2},Ce=O=>{const X=ae(O.heardProb),ie=te(O.freeSim);return X===null&&ie===null?"":X===null?ie:ie===null||ve[X]<=ve[ie]?X:ie},Re=R.map((O,X)=>`<button class="pc-word ${Ce(O)}" type="button" data-pc-word-idx="${X}" aria-label="Speak ${J(O.word)}">${J(O.word)}</button>`).join(""),rt=Vt(E),Nt=rt?"pc-transcript-line pc-transcript-line-rtl":"pc-transcript-line",zt=rt?"◀":"▶",Te=ye.length?`<div class="pc-transcript-row heard" role="button" tabindex="0"
             data-pc-speak="heard" data-no-swipe
             aria-label="Play what Whisper heard">
           <span class="pc-transcript-label">Heard you say</span>
           <span class="${Nt}">
             <span class="pc-transcript-play" aria-hidden="true">${zt}</span>
             <span class="pc-transcript-text">${J(ye)}</span>
           </span>
         </div>`:p?`<div class="pc-transcript-row heard empty">
             <span class="pc-transcript-label">Heard you say</span>
             <span class="pc-transcript-line">
               <span class="pc-transcript-text empty">(couldn't make out the words)</span>
             </span>
           </div>`:"",vn=Te?`<div class="pc-transcripts">${Te}</div>`:"",Yr={"pa-arab":"Different writing system — scoring may be off","yue-hant-hk":"Different writing system — scoring may be off","zh-hans":"Different writing system — scoring may be off","zh-hant":"Different writing system — scoring may be off"},Kr=(a.language??"").toLowerCase(),bn=Yr[Kr],qe=[];l>.2&&qe.push('<div class="pc-chip pc-chip-warn">Sounded faint — try a bit louder</div>');const Vr=E.toLowerCase().split("-")[0],Xr=Vn.has(Vr)?3.5:2.4;d>Xr&&qe.push('<div class="pc-chip pc-chip-warn">Sounded a bit garbled</div>'),p?qe.push(`<div class="pc-chip pc-chip-warn">Couldn't make out the words</div>`):f<.6&&qe.push(`<div class="pc-chip pc-chip-warn">Words didn't quite match</div>`),bn&&qe.push(`<div class="pc-chip">${J(bn)}</div>`);const Qr=qe.length?`<div class="pc-chips pc-diagnostics">${qe.join("")}</div>`:"",Ie=$(b),Ht=C(b),Bt=H(b),Ue=ne(b);if(!Ie||!Ue){console.error("[pronunciation-coach] renderResult: card missing result slots");return}if(A)Ie.className=`pc-result-banner ${T}`,Ie.innerHTML=`
        <span class="pc-result-banner-score">—</span>
        <span class="pc-result-banner-sep">·</span>
        <span class="pc-result-banner-text">${_}</span>
      `,Ie.hidden=!1,Ue.innerHTML=`
        <div class="pc-chips">
          <div class="pc-chip">Move the device closer or speak louder.</div>
        </div>
      `,Ue.hidden=!1;else{Ie.className=`pc-result-banner ${T}`,Ie.innerHTML=`
        <span class="pc-result-banner-score">${k(s)}</span>
        <span class="pc-result-banner-sep">·</span>
        <span class="pc-result-banner-text">${_}</span>
      `,Ie.hidden=!1,Ht&&(Ht.innerHTML=vn,Ht.hidden=!vn),Bt&&(Bt.innerHTML="",Bt.hidden=!0);const O=rt?"pc-words pc-words-rtl":"pc-words";Ue.innerHTML=`
        ${Re?`<div class="${O}">${Re}</div>`:""}
        ${Qr}
      `,Ue.hidden=!1}const wn=(O,X)=>{const ie=(M==null?void 0:M.targetLang)||a.language||"en";try{const pe=t.speak(ie,O);pe&&typeof pe.catch=="function"&&pe.catch(Jr=>{console.error(`[pronunciation-coach] ${X} speak failed:`,Jr)})}catch(pe){console.error(`[pronunciation-coach] ${X} speak threw:`,pe)}};Ue.querySelectorAll("button.pc-word[data-pc-word-idx]").forEach(O=>{O.addEventListener("click",()=>{const X=O.getAttribute("data-pc-word-idx");if(X===null)return;const ie=Number(X),pe=R[ie];pe&&wn(pe.word.trim(),"word")})}),b.querySelectorAll(".pc-transcript-row[data-pc-speak]").forEach(O=>{const X=()=>{ye&&wn(ye,"heard")};O.addEventListener("click",X),O.addEventListener("keydown",ie=>{const pe=ie.key;(pe==="Enter"||pe===" ")&&(ie.preventDefault(),X())})})},Qe=()=>{const a=o;o=null,a&&n.cancelSession({sessionId:a}).catch(s=>{console.error("[pronunciation-coach] cancelSession failed:",s)})},sn=async()=>{if(!M||!P)return;he(),Nr();const a=er();o=a;try{Z("recording");const s=Zt(M.targetLang),l=await n.startSession({sessionId:a,language:s,expectedText:M.target.text,whisperParams:Wt(s)});if(i)return;if(!l.started)throw new Error("STT plugin reported started=false")}catch(s){console.error("[pronunciation-coach] startSession failed:",s),o=null,I(`Could not start recording: ${fe(s)}`),Z("idle")}},Rt=async a=>{if(!n)throw new Error("STT unavailable");const s=Le(a),l=await Yt(n.prepare({model:s}),Wn(a),`Loading ${Q(a)} model`);if(!l.ready){const d=new Error(l.message||"Model not ready");throw d.code=l.code,d}return l};class cn extends Error{constructor(){super("Switch cancelled by user"),this.name="SwitchCancelledError"}}const ln=1500,qt=10,Hr=async a=>{const s=Q(a);let l=null,d=!1;const f=()=>{d=!0};for(let k=1;k<=qt;k++){if(d)throw new cn;try{return await Rt(a)}catch(A){if(pt(A)!=="INSUFFICIENT_MEMORY")throw A;if(l=A,k===qt)break;const _=qt-k;Y(`Freeing memory for ${s}…
This usually takes a few seconds.`,{cancelLabel:"Cancel",onCancel:f}),console.log(`[pronunciation-coach] INSUFFICIENT_MEMORY on attempt ${k}; waiting ${ln}ms, ${_} retries left`),await new Promise(V=>setTimeout(V,ln))}}throw l??new Error("INSUFFICIENT_MEMORY")},dn=async()=>{const a=o;if(!a){Z("idle");return}o=null;try{Z("scoring");const s=await Yt(n.stopSession({sessionId:a}),jn,"Scoring");if(i)return;zr(s),Z("idle")}catch(s){const l=fe(s),d=pt(s);if(console.error(`[pronunciation-coach] stopSession failed (code=${d??"—"}):`,l),Z("idle"),d==="LOAD_FAILED"){P=!1,q.disabled=!0,g.textContent="Model needs reinstall",I(`${Q(x)} model failed to load — opening setup so you can reinstall.`),It().catch(f=>{console.error("[pronunciation-coach] openModelSetup after LOAD_FAILED:",f)});return}if(d==="NETWORK"){I("Network hiccup while scoring. Try again — your model is fine.");return}I(`Scoring failed: ${l}`)}};q.addEventListener("click",()=>{ee==="idle"?sn().catch(a=>{console.error("[pronunciation-coach] startRecording threw:",a)}):ee==="recording"&&dn().catch(a=>{console.error("[pronunciation-coach] stopRecording threw:",a)})}),w.addEventListener("click",()=>{Qe(),r!=null&&r.onClose?r.onClose():ft()});const pn=async a=>{if(!(n!=null&&n.prepare))return!1;try{const s=await n.prepare({model:Le(a)});return s.ready?!0:(console.error(`[pronunciation-coach] ensureLoaded(${a}) failed: code=${s.code??"—"} msg=${s.message??""}`),!1)}catch(s){return console.error(`[pronunciation-coach] ensureLoaded(${a}) threw:`,s),!1}},It=async()=>{if(oe)return;oe=!0,Qe(),Z("idle");const a=x,s=P?x:null;console.log(`[pronunciation-coach] openModelSetup: modelMode=${x} modelReady=${P} activeForOverlay=${s??"null"}`);let l;try{l=await Gr({currentActive:s,headline:"Parlometron · Models",sub:"These are large, experimental, cutting-edge AI speech models running entirely on your device — no servers, no internet, no privacy compromises. They are also, frankly, not as reliable as you might hope. The bigger ones might crash your phone. The smaller ones might transcribe 'good morning' as 'goldfish moon'. Any of them might surprise you in either direction. Welcome to on-device AI in 2026. Don't take the scoring too seriously. 🤷"})}finally{oe=!1,Oe()}if(i)return;if(l.kind==="exit"){!P&&a&&await pn(a)&&(P=!0);return}if(l.kind==="cancelled"){Z("idle"),!P&&a&&await pn(a)&&(P=!0);return}if(l.mode===a&&P){Z("idle");return}const d=l.mode,f=Q(d),k=ue(d),A=(k==null?void 0:k.approxSizeMB)??0;if(A>0&&(n!=null&&n.getStatus))try{const _=(await n.getStatus()).availableMemoryMB??null;if(_!==null&&_<A*.5){console.warn(`[pronunciation-coach] pre-flight refused switch to ${d}: avail=${_}MB target=${A}MB`),Z("idle"),I(`Not enough memory to switch to ${f} right now (${_} MB free, need ~${Math.round(A*1.3)} MB). Close other apps and restart Corpán, then try again. Your current model is still loaded.`);return}}catch(T){console.warn("[pronunciation-coach] pre-flight status check failed; deferring to native gate:",T)}if(P=!1,q.disabled=!0,n!=null&&n.unload&&a&&a!==d){g.textContent=`Unloading ${Q(a)}…`,Y(`Unloading ${Q(a)} model to free memory…`);try{await n.unload()}catch(T){console.warn("[pronunciation-coach] explicit unload before switch failed:",T)}}g.textContent=`Loading ${f} model…`,Y(`Loading ${f} model…
This can take 10–30s on first launch.`);try{const T=await Hr(d);P=!0,x=d,Me(),Oe(),console.log(`[pronunciation-coach] WhisperKit prepared: ${T.model} (${f})`),j(),q.disabled=!1,Z("idle")}catch(T){const _=fe(T),V=pt(T),L=T instanceof cn;if(console.error(`[pronunciation-coach] post-setup load ${L?"cancelled":"failed"} (code=${V??"—"}):`,L?"user cancel":_),a&&a!==d)try{const re=await Rt(a);P=!0,x=a,Oe(),j(),q.disabled=!1,Z("idle"),I(L?`Switch to ${f} cancelled. Staying on ${Q(a)}.`:V==="MODEL_NOT_INSTALLED"?`${f} isn't installed yet. Staying on ${Q(a)}.`:V==="NETWORK"?`${f} needs the tokenizer — check your connection. Staying on ${Q(a)}.`:V==="INSUFFICIENT_MEMORY"?`Not enough memory to load ${f}. Close other apps and restart Corpán, then try the switch again. Reverted to ${Q(a)}.`:`Couldn't switch to ${f}: ${_}. Staying on ${Q(a)}.`),console.log(`[pronunciation-coach] reverted to ${re.model} (${Q(a)}) after switch failure`);return}catch(re){console.error("[pronunciation-coach] revert to previous model also failed:",re)}j(),I(L?`Switch to ${f} cancelled.`:V==="MODEL_NOT_INSTALLED"?`${f} model isn't fully installed (likely a partial download). Tap the model badge to reinstall.`:V==="NETWORK"?`${f} model needs the tokenizer — check your connection and try again.`:V==="INSUFFICIENT_MEMORY"?`Not enough memory to load ${f}. Close other apps and restart Corpán, then try again.`:`Could not load ${f} model: ${_}`),g.textContent="Model unavailable"}};y.addEventListener("click",()=>{It().catch(a=>{console.error("[pronunciation-coach] openModelSetup threw:",a)})});let vt=!1,Pt=0,un=0,mn=0,bt=0,At=0,Je=!1,Ot=!1,Ze=null,wt=!1;const Br=()=>{if(M)try{const a=t.speak(M.targetLang,M.target.text);a&&typeof a.catch=="function"&&a.catch(s=>{console.error("[pronunciation-coach] speak phrase failed:",s)})}catch(a){console.error("[pronunciation-coach] speak phrase threw:",a)}},Dr=a=>!a||!(a instanceof Element)?!1:!!a.closest("button, input, textarea, select, a, [data-no-swipe]"),Be=S;Be.addEventListener("pointerdown",a=>{ee!=="scoring"&&(Dr(a.target)||a.pointerType==="mouse"&&a.button!==0||(vt=!0,Pt=a.clientX,un=a.clientY,bt=a.clientX,At=a.clientY,mn=performance.now(),Je=!1,Ot=!1,Ze=null,b.classList.add("dragging")))},{passive:!0}),Be.addEventListener("pointermove",a=>{if(!vt)return;bt=a.clientX,At=a.clientY;const s=bt-Pt,l=At-un;if(!Je&&!Ot)if(Math.abs(s)>12&&Math.abs(s)>Math.abs(l)*1.2){Je=!0;try{Be.setPointerCapture(a.pointerId),Ze=a.pointerId}catch{}}else Math.abs(l)>12&&(Ot=!0);if(Je){const d=s*.9;b.style.transition="none",b.style.transform=`translateX(${d}px) rotate(${d*.01}deg)`,b.style.opacity=String(Math.max(.4,1-Math.abs(s)/400))}},{passive:!0});const fn=()=>{if(!vt)return;if(vt=!1,b.classList.remove("dragging"),Ze!==null){try{Be.releasePointerCapture(Ze)}catch{}Ze=null}if(!Je){b.style.transition="transform 200ms ease, opacity 200ms ease",b.style.transform="",b.style.opacity="";return}const a=bt-Pt,s=Math.max(1,performance.now()-mn),l=Math.abs(a)/s,d=Math.abs(a)>=Dn,f=l>=Fn;d||f?(wt=!0,window.setTimeout(()=>{wt=!1},500),a<0?yt().catch(k=>console.error("[pronunciation-coach] swipe-next failed:",k)):U>0?on().catch(k=>console.error("[pronunciation-coach] swipe-prev failed:",k)):(b.style.transition="transform 220ms ease, opacity 220ms ease",b.style.transform="",b.style.opacity="")):(b.style.transition="transform 220ms ease, opacity 220ms ease",b.style.transform="",b.style.opacity="")};Be.addEventListener("pointerup",fn,{passive:!0}),Be.addEventListener("pointercancel",fn,{passive:!0}),F.addEventListener("click",a=>{if(wt){wt=!1;return}const s=a.target;s&&(s.closest("button, input, a")||s.closest(".pc-target, .pc-romanization")&&Br())});const hn=a=>{a.key==="ArrowLeft"?on().catch(s=>console.error("[pronunciation-coach] arrow-left failed:",s)):a.key==="ArrowRight"?yt().catch(s=>console.error("[pronunciation-coach] arrow-right failed:",s)):a.key==="Escape"?ft():(a.key===" "||a.code==="Space")&&(a.preventDefault(),ee==="idle"&&P&&M?sn().catch(s=>console.error("[pronunciation-coach] space-start failed:",s)):ee==="recording"&&dn().catch(s=>console.error("[pronunciation-coach] space-stop failed:",s)))};window.addEventListener("keydown",hn);const Fr=700,Ur=8;let et=null,De=null,tt=null;const Fe=()=>{et!==null&&(window.clearTimeout(et),et=null),De=null,tt=null},gn=a=>{var d,f;const s=(f=(d=a.target)==null?void 0:d.closest)==null?void 0:f.call(d,"[data-pc-lang-badge]");if(!s)return;const l=s.getAttribute("data-pc-lang")||"";l&&(De={x:a.clientX,y:a.clientY},tt=l,et=window.setTimeout(()=>{et=null,tt&&!i&&Cn(tt),tt=null,De=null},Fr))},yn=a=>{if(!De)return;const s=a.clientX-De.x,l=a.clientY-De.y;Math.hypot(s,l)>Ur&&Fe()};e.addEventListener("pointerdown",gn),e.addEventListener("pointermove",yn),e.addEventListener("pointerup",Fe),e.addEventListener("pointercancel",Fe);const Wr=()=>{const a=Jt(de);if(!a||!a.phrases||a.phrases.length===0)return!1;ce=Math.max(0,Math.floor(a.streak)),K.length=0;for(const l of a.phrases)K.push(Yn(l));const s=Math.max(0,Math.min(K.length-1,a.idx));return U=s,M=K[s],M&&se(),Ve(),!0},jr=async()=>{const a=t.getStackConfig();if(!a.languages||a.languages.length<2){M=null,W(b,"Set up at least one target language","Open Corpán settings and add a target language to start practising."),q.disabled=!0,g.textContent="—";return}if(Wr()){console.log(`[pronunciation-coach] restored ${K.length} phrase(s) from storage; idx=${U}, streak=${ce}`),we();return}try{const s=await He();if(i)return;if(!s){I("No phrases available — check your stack config.");return}K.push(s),U=0,M=s,se(),Me(),we()}catch(s){console.error("[pronunciation-coach] loadFirstPhrase failed:",s),M=null,I(`Could not load a phrase: ${fe(s)}`),q.disabled=!0,g.textContent="—"}},Gr=a=>new Promise(s=>{let{currentActive:l}=a;const d=document.createElement("div");d.className="pc-setup-root",d.innerHTML=`
        <div class="pc-backdrop"></div>
        <div class="pc-setup">
          <div class="pc-setup-header">
            <div class="pc-subtitle">Speech Models</div>
            <button class="pc-close" id="pc-setup-close" type="button" aria-label="Close">×</button>
          </div>
          <div class="pc-setup-body">
            <h1 class="pc-setup-headline">${J(a.headline)}</h1>
            <p class="pc-setup-sub">${J(a.sub)}</p>

            ${$t().map(p=>{const E=p.approxSizeMB>=1e3?`~${(p.approxSizeMB/1e3).toFixed(1)} GB`:`~${p.approxSizeMB} MB`;return`
            <div class="pc-setup-card" data-mode="${p.id}">
              <div class="pc-setup-card-head">
                <div>
                  <div class="pc-setup-card-name">${J(p.label)} <span class="pc-setup-card-status" data-status="${p.id}"></span></div>
                  <div class="pc-setup-card-meta">${E}</div>
                </div>
                <div class="pc-setup-card-actions" data-actions="${p.id}"></div>
              </div>
              <div class="pc-setup-card-desc">${J(p.shortDesc)}</div>
              <div class="pc-setup-card-procon">
                <ul class="pc-setup-card-pros">
                  ${p.pros.map(G=>`<li>${J(G)}</li>`).join("")}
                </ul>
                <ul class="pc-setup-card-cons">
                  ${p.cons.map(G=>`<li>${J(G)}</li>`).join("")}
                </ul>
              </div>
              <div class="pc-setup-card-techid" title="Underlying model file (whisper.cpp ggml format)">${J(p.folder)}</div>
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
      `,e.appendChild(d);const f=d.querySelector("#pc-setup-error"),k=Object.fromEntries($t().map(p=>[p.id,p.id===l?!0:null]));let A=null;const T=(p,E)=>{const G=d.querySelector(`[data-progress="${p}"]`);G&&(G.hidden=!E)},_=(p,E,G)=>{const R=d.querySelector(`[data-progress="${p}"]`);if(!R)return;const ae=R.querySelector(".pc-setup-progress-fill");ae&&(ae.style.width=`${Math.round(Math.max(0,Math.min(1,E))*100)}%`);const te=R.querySelector(".pc-setup-progress-label");te&&(te.textContent=G)},V=()=>{d.parentNode&&d.parentNode.removeChild(d)},L=()=>{for(const p of Ee){const E=p.id,G=d.querySelector(`[data-status="${E}"]`),R=d.querySelector(`[data-actions="${E}"]`);if(!G||!R)continue;const ae=l===E,te=A===E,ve=ae?!0:k[E],Ce=ve===null&&!ae&&!te;if(G.textContent=te?"Installing…":ae?"Active":Ce?"Checking…":ve?"Installed":"Not installed",G.dataset.state=te?"installing":ae?"active":Ce?"checking":ve?"installed":"absent",R.innerHTML="",te||Ce)continue;const Re=(rt,Nt,zt)=>{const Te=document.createElement("button");Te.type="button",Te.className=`pc-setup-btn pc-setup-btn-${Nt}`,Te.textContent=rt,Te.addEventListener("click",zt),R.appendChild(Te)};ve?ae||(Re("Use this","primary",()=>{console.log(`[pronunciation-coach] CLICK Use-this mode=${E}`),ye(E)}),Re("Reinstall","ghost",()=>{console.log(`[pronunciation-coach] CLICK Reinstall mode=${E}`),Lt(E,!0)}),Re("Remove","danger",()=>{console.log(`[pronunciation-coach] CLICK Remove mode=${E}`),St(E)})):Re("Install","primary",()=>{console.log(`[pronunciation-coach] CLICK Install mode=${E}`),Lt(E)})}},re=async()=>{if(n!=null&&n.validateModel){for(const p of Ee){if(l===p.id){k[p.id]=!0;continue}try{const E=await n.validateModel({model:p.folder});k[p.id]=E.valid}catch(E){console.error(`[pronunciation-coach] validate ${p.id} failed:`,E),k[p.id]=!1}}L()}},ye=p=>{V(),s({kind:"selected",mode:p})},St=async p=>{if(A||!(n!=null&&n.wipeModel))return;console.log(`[pronunciation-coach] removeModel: mode=${p} folder=${Le(p)} currentActive=${l??"null"} installed[${p}]=${k[p]}`);const E=k[p];A=p,L(),f.hidden=!0;try{await n.wipeModel({model:Le(p)}),k[p]=!1,l===p&&(l=null)}catch(G){k[p]=E;const R=fe(G);f.textContent=`Remove failed: ${R}`,f.hidden=!1}finally{A=null,L()}},Lt=async(p,E=!1)=>{var G;if(!(A||i||!(n!=null&&n.installModel))){if(A=p,f.hidden=!0,f.textContent="",L(),T(p,!0),E&&(n!=null&&n.wipeModel)){_(p,0,"Wiping previous install…");try{await n.wipeModel({model:Le(p)})}catch(R){console.warn("[pronunciation-coach] pre-reinstall wipe failed (continuing):",R)}}_(p,0,"Starting…");try{if(await n.installModel({model:Le(p),downloadUrl:(G=ue(p))==null?void 0:G.downloadUrl},R=>{if(R.model===Le(p))if(R.phase==="downloading"){let te=`Downloading ${Math.round((R.fraction??0)*100)}%`;if(R.completed!=null&&R.total&&R.total>0){const ve=Ce=>(Ce/1048576).toFixed(0);te+=` · ${ve(R.completed)} / ${ve(R.total)} MB`}_(p,R.fraction??0,te)}else R.phase==="verifying"?_(p,1,"Verifying files…"):R.phase==="verified"?_(p,1,"Verified ✓"):R.phase==="failed"&&_(p,0,`Failed: ${R.error??"unknown"}`)}),i)return;k[p]=!0,A=null,_(p,1,"Verified ✓"),setTimeout(()=>{V(),s({kind:"selected",mode:p})},300)}catch(R){A=null,T(p,!1);const ae=fe(R);if(console.error(`[pronunciation-coach] install ${p} failed:`,ae),f.textContent=`Install failed: ${ae}`,f.hidden=!1,l&&l!==p&&(n!=null&&n.prepare))try{(await n.prepare({model:Le(l)})).ready&&console.log(`[pronunciation-coach] restored ${l} kit after ${p} install failed`)}catch(te){console.error(`[pronunciation-coach] kit restore after ${p} install failure threw:`,te)}L()}}},nt=d.querySelector("#pc-setup-close");if(nt==null||nt.addEventListener("click",()=>{A||(V(),l&&k[l]?s({kind:"cancelled"}):(ft(),s({kind:"exit"})))}),l){const p=d.querySelector(`[data-mode="${l}"]`);p==null||p.classList.add("pc-setup-card-suggested")}L(),re().catch(p=>{console.error("[pronunciation-coach] refreshInstallState threw:",p)})});return(async()=>{var V;Y("Checking models…");let a;try{a=await n.isAvailable()}catch(L){if(console.error("[pronunciation-coach] stt.isAvailable bridge call threw:",L),i)return;j(),v("Speech recognition bridge failed",`The native speech-recognition plugin returned an error: ${String(L)}`);return}if(i)return;if(!a){j(),v();return}try{const L=await n.getStatus();$n(L.availableMemoryMB??null,L.physicalMemoryMB??null),console.log(`[pronunciation-coach] device memory budget: available=${L.availableMemoryMB??"?"}MB physical=${L.physicalMemoryMB??"?"}MB raw=${JSON.stringify(L)}`)}catch(L){console.warn("[pronunciation-coach] getStatus failed; using conservative budget (Large variants hidden):",L)}const s=Jt(de);s!=null&&s.mode&&ue(s.mode)&&(x=s.mode);const l=ue(x);if(l&&Tn(l)){const L=Mn().id;console.warn(`[pronunciation-coach] saved model "${x}" exceeds this device's memory budget; demoting to "${L}"`),x=L}Oe();const d=Q(x),f=(((V=ue(x))==null?void 0:V.approxSizeMB)??0)>=300;Y(f?`Loading ${d} model… first load can take ~1 minute for large models. Subsequent launches are faster.`:`Loading ${d} model…`),g.textContent=f?`Loading ${d} model… (first time can take ~1 minute)`:`Loading ${d} model…`;const k=x;let A=null,T;try{await Promise.all([Rt(k).then(L=>{P=!0,console.log(`[pronunciation-coach] WhisperKit prepared: ${L.model} (${Q(k)})`)}),jr()])}catch(L){A=L,T=pt(L),console.error(`[pronunciation-coach] boot prepare failed (code=${T??"—"}):`,fe(L));const re=fe(L);!T&&/<model dir missing>|Run install first/i.test(re)&&console.warn("%c[pronunciation-coach] STALE PLUGIN DETECTED","background:#9333ea;color:#fff;padding:2px 6px;border-radius:4px;font-weight:600","\nThe host app is running an old tauri-plugin-stt binary (no `code` field on errors, no marker file).",`
ValidateModel false-negatives in that build trigger destructive wipes on every Install click.`,`
Fix: rebuild and reinstall the host app (cargo tauri ios dev / android dev) to pick up the marker-file fix.`)}if(i)return;if(P&&!A){j(),Z("idle");return}j();const _=Q(k);if(T==="NETWORK"){I(`${_} model needs the tokenizer — check your connection. Your model files are intact.`),q.disabled=!0,g.textContent="Network needed";return}if(T&&T!=="MODEL_NOT_INSTALLED"&&T!=="LOAD_FAILED"){I(`Model failed to load: ${fe(A)}`),q.disabled=!0,g.textContent="Model unavailable";return}T==="LOAD_FAILED"&&I(`${_} model failed to load. Use Reinstall in setup if it keeps happening.`),q.disabled=!0,g.textContent=`Loading ${_} model…`,It().catch(L=>{console.error("[pronunciation-coach] openModelSetup after boot prepare failure threw:",L)})})().catch(a=>{console.error("[pronunciation-coach] boot threw:",a)}),{unmount:()=>{i=!0,Qe(),window.removeEventListener("keydown",hn),e.removeEventListener("pointerdown",gn),e.removeEventListener("pointermove",yn),e.removeEventListener("pointerup",Fe),e.removeEventListener("pointercancel",Fe),Fe(),j(),h(),e.innerHTML=""}}},Et=3,en="pc:parlometron:game-state",or=()=>{try{return crypto.randomUUID()}catch{return`p_${Math.random().toString(36).slice(2,10)}_${Date.now()}`}},xt=e=>({id:or(),name:e}),sr=(e,t)=>{if(e.length<2)throw new Error("Parlometron needs at least 2 players");return{players:e.map(r=>({...r})),winTarget:t,currentRound:0,currentRoundOrder:[],currentPlayerIdx:0,attemptsLeft:{},bestThisRound:{},expectedTextThisRound:"",roundsWon:Object.fromEntries(e.map(r=>[r.id,0])),history:[]}},ir=e=>{const t=e.slice();for(let r=t.length-1;r>0;r--){const n=Math.floor(Math.random()*(r+1));[t[r],t[n]]=[t[n],t[r]]}return t},cr=(e,t)=>(e.currentRound+=1,e.currentRoundOrder=ir(e.players.map(r=>r.id)),e.currentPlayerIdx=0,e.attemptsLeft=Object.fromEntries(e.players.map(r=>[r.id,Et])),e.bestThisRound=Object.fromEntries(e.players.map(r=>[r.id,null])),e.expectedTextThisRound=t,e),lr=(e,t,r)=>{const n=e.currentRoundOrder[e.currentPlayerIdx];if(!n||(e.attemptsLeft[n]??0)<=0)return e;const i=e.bestThisRound[n],o=Math.max(0,Math.min(100,Math.round(t)));return(!i||o>i.bestPercent)&&(e.bestThisRound[n]={playerId:n,bestPercent:o,heardText:r}),e.attemptsLeft[n]=Math.max(0,(e.attemptsLeft[n]??0)-1),e},dr=e=>{const t=e.currentRoundOrder[e.currentPlayerIdx];return t&&(e.attemptsLeft[t]=0),e.currentPlayerIdx+=1,e},pr=e=>e.currentPlayerIdx>=e.currentRoundOrder.length,ur=e=>e.players.some(t=>(e.roundsWon[t.id]??0)>=e.winTarget),mr=e=>{let t=-1;for(const r of e.players){const n=e.roundsWon[r.id]??0;n>t&&(t=n)}return t<1?[]:e.players.filter(r=>(e.roundsWon[r.id]??0)===t)},fr=e=>{var o;const t=e.players.map(c=>e.bestThisRound[c.id]??{playerId:c.id,bestPercent:0,heardText:""}).sort((c,u)=>u.bestPercent-c.bestPercent),r=((o=t[0])==null?void 0:o.bestPercent)??0,n=r>0?t.filter(c=>c.bestPercent===r).map(c=>c.playerId):[];for(const c of n)e.roundsWon[c]=(e.roundsWon[c]??0)+1;const i={round:e.currentRound,expectedText:e.expectedTextThisRound,results:t,winnerIds:n};return e.history.push(i),{state:e,round:i}},_t=e=>{const t=e.currentRoundOrder[e.currentPlayerIdx];return t?e.players.find(r=>r.id===t)??null:null},ht=e=>{try{localStorage.setItem(en,JSON.stringify(e))}catch(t){console.error("[parlometron/state] save failed:",t)}},Ge=()=>{try{localStorage.removeItem(en)}catch(e){console.error("[parlometron/state] clear failed:",e)}},gt=2,Ye=8,tn=e=>e.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/'/g,"&#39;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),hr=e=>{var w,D;const t=((w=e.initial)==null?void 0:w.players.map(m=>({...m})))??[xt("Player 1"),xt("Player 2")];let r=((D=e.initial)==null?void 0:D.winTarget)??5;const n=()=>{const m=[3,5,7].map(y=>`
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
          <h3 class="pc-pm-section-title">Players (${t.length} / ${Ye})</h3>
          <ul class="pc-pm-roster" id="pc-pm-roster">${i()}</ul>
          <button class="pc-pm-add" data-pm-add
                  ${t.length>=Ye?"disabled":""}>
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
    `,v(),o()},i=()=>t.map((m,y)=>`
        <li class="pc-pm-roster-row" data-pm-row="${m.id}">
          <span class="pc-pm-roster-num">${y+1}</span>
          <input type="text"
                 class="pc-pm-roster-name"
                 data-pm-name="${m.id}"
                 value="${tn(m.name)}"
                 maxlength="24"
                 placeholder="Player name"
                 autocapitalize="words"
                 autocorrect="off"
                 spellcheck="false" />
          <button class="pc-pm-roster-remove"
                  data-pm-remove="${m.id}"
                  aria-label="Remove ${tn(m.name)}"
                  ${t.length<=gt?"disabled":""}>×</button>
        </li>`).join(""),o=()=>{const m=e.container.querySelector("#pc-pm-start");if(!m)return;const y=t.every(S=>S.name.trim().length>0);m.disabled=!y||t.length<gt},c=()=>{const m=e.container.querySelector("[data-pm-add]");m&&(m.disabled=t.length>=Ye)},u=()=>{const m=e.container.querySelector("#pc-pm-roster");m&&(m.innerHTML=i());const y=e.container.querySelector(".pc-pm-section-title");y&&(y.textContent=`Players (${t.length} / ${Ye})`),h(),c(),o()},h=()=>{e.container.querySelectorAll("[data-pm-name]").forEach(m=>{const y=m.getAttribute("data-pm-name")||"";m.addEventListener("input",()=>{const S=t.find(F=>F.id===y);S&&(S.name=m.value),o()})}),e.container.querySelectorAll("[data-pm-remove]").forEach(m=>{m.addEventListener("click",()=>{if(t.length<=gt)return;const y=m.getAttribute("data-pm-remove")||"",S=t.findIndex(F=>F.id===y);S>=0&&(t.splice(S,1),u())})})},v=()=>{var m,y,S;(m=e.container.querySelector("[data-pm-back]"))==null||m.addEventListener("click",()=>e.onBack()),(y=e.container.querySelector("[data-pm-add]"))==null||y.addEventListener("click",()=>{t.length>=Ye||(t.push(xt(`Player ${t.length+1}`)),u())}),e.container.querySelectorAll("[data-pm-target]").forEach(F=>{F.addEventListener("click",()=>{const b=Number(F.getAttribute("data-pm-target"));(b===3||b===5||b===7)&&(r=b,e.container.querySelectorAll("[data-pm-target]").forEach(q=>{q.classList.toggle("active",Number(q.getAttribute("data-pm-target"))===b)}))})}),(S=e.container.querySelector("#pc-pm-start"))==null||S.addEventListener("click",()=>{const F=t.map(q=>({...q,name:q.name.trim()})).filter(q=>q.name.length>0);if(F.length<gt)return;const b=sr(F,r);e.onStart(b)}),h()};return n(),{unmount:()=>{e.container.innerHTML=""}}},Ct=e=>e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),nn=e=>new Promise(t=>{var o,c,u;const r=document.createElement("div");r.className="pc-pm-confirm-root",r.innerHTML=`
      <div class="pc-pm-confirm-backdrop" data-pm-confirm-backdrop></div>
      <div class="pc-pm-confirm-sheet" role="alertdialog" aria-modal="true">
        <p class="pc-pm-confirm-msg">${Ct(e.message)}</p>
        <div class="pc-pm-confirm-foot">
          <button class="pc-pm-confirm-cancel" data-pm-confirm-cancel>
            ${Ct(e.cancelLabel??"Cancel")}
          </button>
          <button class="pc-pm-confirm-go ${e.destructive?"danger":""}"
                  data-pm-confirm-go>
            ${Ct(e.confirmLabel??"Confirm")}
          </button>
        </div>
      </div>`,document.body.appendChild(r),requestAnimationFrame(()=>r.classList.add("open"));const n=h=>{r.classList.remove("open"),window.setTimeout(()=>{r.parentNode&&r.parentNode.removeChild(r)},200),window.removeEventListener("keydown",i),t(h)},i=h=>{h.key==="Escape"?n(!1):h.key==="Enter"&&n(!0)};window.addEventListener("keydown",i),(o=r.querySelector("[data-pm-confirm-backdrop]"))==null||o.addEventListener("click",()=>n(!1)),(c=r.querySelector("[data-pm-confirm-cancel]"))==null||c.addEventListener("click",()=>n(!1)),(u=r.querySelector("[data-pm-confirm-go]"))==null||u.addEventListener("click",()=>n(!0))}),gr=9e4,yr=()=>`pm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`,Ke=e=>e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),vr=e=>Ke(e).replace(/"/g,"&quot;").replace(/'/g,"&#39;"),br=e=>e?e.split("-")[0].toLowerCase():"en",wr=async(e,t,r)=>{let n=null;const i=new Promise((o,c)=>{n=setTimeout(()=>{c(new Error(`${r} timed out after ${Math.round(t/1e3)}s`))},t)});try{return await Promise.race([e,i])}finally{n&&clearTimeout(n)}},Sr=(e,t)=>{const r=t.length>0?e.translations.find(o=>o.language_code===t[0])??null:null,n=[];for(const o of t.slice(1)){const c=e.translations.find(u=>u.language_code===o);c&&n.push(c)}return{target:n.length>0?n[Math.floor(Math.random()*n.length)]:null,native:r}},Lr=e=>{var ke;const t=e.hostApi.stt;if(!t)return e.container.innerHTML=`
      <div class="pc-pm-root pc-pm-error">
        <p>Whisper STT is not available on this device.</p>
        <button class="pc-pm-start" data-pm-quit>Back</button>
      </div>`,(ke=e.container.querySelector("[data-pm-quit]"))==null||ke.addEventListener("click",e.onQuit),{unmount:()=>e.container.innerHTML=""};let r=!1,n="loading",i=null,o=null,c=null,u=null,h=null;const v=()=>{var $,C,H,ne;e.container.innerHTML=`
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
      </div>`,($=e.container.querySelector("[data-pm-quit]"))==null||$.addEventListener("click",async()=>{await nn({message:"Quit this game? Scores will be lost.",confirmLabel:"Quit",cancelLabel:"Keep playing",destructive:!0})&&(i&&(t.cancelSession({sessionId:i}).catch(N=>console.error("[parlometron/round] cancel failed:",N)),i=null),e.onQuit())}),(C=e.container.querySelector("[data-pm-mic]"))==null||C.addEventListener("click",m),(H=e.container.querySelector("[data-pm-pass]"))==null||H.addEventListener("click",b),(ne=e.container.querySelector("[data-pm-splash-go]"))==null||ne.addEventListener("click",()=>{n="ready",w()});const g=e.container.querySelector("[data-pm-target]");g&&g.addEventListener("click",()=>{const B=o==null?void 0:o.text,N=o==null?void 0:o.language_code;if(!(!B||!N))try{const Y=e.hostApi.speak(N,B);Y&&typeof Y.catch=="function"&&Y.catch(j=>console.error("[parlometron/round] phrase speak failed:",j))}catch(Y){console.error("[parlometron/round] phrase speak threw:",Y)}})},w=()=>{if(r)return;const g=_t(e.game),$=g?e.game.attemptsLeft[g.id]??0:0,C=Et-$,H=g?e.game.currentRoundOrder.indexOf(g.id)+1:e.game.currentRoundOrder.length,ne=e.game.currentRoundOrder.length,B=x=>e.container.querySelector(x),N=B("[data-pm-eyebrow]");if(N){const x=o!=null&&o.language_code?o.language_code.split("-")[0].toUpperCase():"",oe=x?` · ${x}`:"";N.textContent=`Round ${e.game.currentRound}${oe} · First to ${e.game.winTarget}`}const Y=B("[data-pm-headline]");Y&&(Y.textContent=`${(g==null?void 0:g.name)??"—"}'s turn`);const j=B("[data-pm-turn]");j&&(j.textContent=`${H} / ${ne}`);const I=B("[data-pm-target]");I&&(I.textContent=(o==null?void 0:o.text)??"Loading…");const he=B("[data-pm-roman]");if(he){const oe=!!e.hostApi.getStackConfig().showRomanization,de=((o==null?void 0:o.romanization)??"").trim();oe&&de?(he.textContent=de,he.hidden=!1):he.hidden=!0}const ee=B("[data-pm-native]");if(ee){const x=((c==null?void 0:c.text)??"").trim();x?(ee.textContent=x,ee.hidden=!1):ee.hidden=!0}D();const P=B("[data-pm-mic]"),M=B("[data-pm-mic-label]"),K=B("[data-pm-tries]");P&&(P.classList.remove("recording","scoring"),P.disabled=n==="scoring"||n==="loading",n==="recording"?P.classList.add("recording"):n==="scoring"&&P.classList.add("scoring")),M&&(M.textContent=n==="loading"?"Loading…":n==="passing"?`${(g==null?void 0:g.name)??"—"}, get ready`:n==="recording"?"Tap to stop":n==="scoring"?"Scoring…":n==="result"&&$>0?"Tap to try again":n==="result"?"Tap mic or pass":"Tap to speak"),K&&(K.innerHTML=Array.from({length:Et},(x,oe)=>`<span class="pc-pm-try-dot ${oe<C?"used":""}"></span>`).join(""));const U=B("[data-pm-pass]");U&&U.classList.toggle("is-invisible",n!=="result");const ge=B("[data-pm-splash]"),ce=B("[data-pm-splash-name]");ge&&(ge.hidden=n!=="passing"),ce&&(ce.textContent=(g==null?void 0:g.name)??"next player")},D=()=>{var Xe;const g=e.container.querySelector("[data-pm-banner]"),$=e.container.querySelector("[data-pm-transcript]"),C=e.container.querySelector("[data-pm-detail]");if(!g||!$||!C)return;if(h&&!u){g.className="pc-result-banner bad",g.innerHTML=`<span class="pc-result-banner-text">${Ke(h)}</span>`,g.hidden=!1,$.hidden=!0,C.hidden=!0,$.innerHTML="",C.innerHTML="";return}if(!u||n!=="result"){g.hidden=!0,$.hidden=!0,C.hidden=!0,g.innerHTML="",$.innerHTML="",C.innerHTML="";return}const H=u,ne=Math.max(0,Math.min(1,H.overallScore)),B=Math.round(ne*100),N=ne>=.85?"good":ne>=.6?"okay":"bad",Y=N==="good"?"Nailed it":N==="okay"?"Close — try again":"";g.className=`pc-result-banner ${N}`,g.innerHTML=Y?`
      <span class="pc-result-banner-score">${B}%</span>
      <span class="pc-result-banner-sep">·</span>
      <span class="pc-result-banner-text">${Ke(Y)}</span>`:`<span class="pc-result-banner-score">${B}%</span>`,g.hidden=!1;const j=(H.freeText||H.text||"").trim(),I=Vt((o==null?void 0:o.language_code)??H.language??""),he=I?"pc-transcript-line pc-transcript-line-rtl":"pc-transcript-line",ee=I?"◀":"▶";j?($.innerHTML=`
        <div class="pc-transcripts">
          <div class="pc-transcript-row heard" role="button" tabindex="0"
               data-pm-speak-heard
               aria-label="Play what Whisper heard">
            <span class="pc-transcript-label">Heard you say</span>
            <span class="${he}">
              <span class="pc-transcript-play" aria-hidden="true">${ee}</span>
              <span class="pc-transcript-text">${Ke(j)}</span>
            </span>
          </div>
        </div>`,$.hidden=!1,(Xe=$.querySelector("[data-pm-speak-heard]"))==null||Xe.addEventListener("click",()=>{const z=o==null?void 0:o.language_code;if(z)try{const W=e.hostApi.speak(z,j);W&&typeof W.catch=="function"&&W.catch(se=>console.error("[parlometron/round] heard speak failed:",se))}catch(W){console.error("[parlometron/round] heard speak threw:",W)}})):($.innerHTML="",$.hidden=!0);const P=((o==null?void 0:o.text)??"").trim(),M=(o==null?void 0:o.language_code)??H.language??"",K=Xt(H.words??[]),U=ut(P),ge=ut(j),ce=U.length>0&&U.length===K.length,x=U.length>0&&U.length===ge.length,oe=j.length&&P.length?mt($e(j,M),$e(P,M)):null,de=U.length?U.map((z,W)=>({word:z,heardProb:ce?K[W].probability:null,freeSim:x?mt($e(z,M),$e(ge[W],M)):oe})):P?[{word:P,heardProb:null,freeSim:oe}]:[],Me=z=>z===null?null:z>=.9?"good":z>=.6?"okay":"bad",Oe=z=>z===null?null:z>=.85?"good":z>=.6?"okay":"bad",Ve={bad:0,okay:1,good:2},Z=z=>{const W=Me(z.heardProb),se=Oe(z.freeSim);return W===null&&se===null?"":W===null?se:se===null||Ve[W]<=Ve[se]?W:se},Ne=de.map((z,W)=>`<button class="pc-word ${Z(z)}" type="button"
                   data-pm-word-idx="${W}"
                   aria-label="Speak ${vr(z.word)}">${Ke(z.word)}</button>`).join(""),be=I?"pc-words pc-words-rtl":"pc-words";C.innerHTML=Ne?`<div class="${be}">${Ne}</div>`:"",C.hidden=!Ne,C.querySelectorAll("[data-pm-word-idx]").forEach(z=>{z.addEventListener("click",()=>{var He;const W=Number(z.getAttribute("data-pm-word-idx")),se=(He=de[W])==null?void 0:He.word.trim(),ze=o==null?void 0:o.language_code;if(!(!se||!ze))try{const we=e.hostApi.speak(ze,se);we&&typeof we.catch=="function"&&we.catch(yt=>console.error("[parlometron/round] word speak failed:",yt))}catch(we){console.error("[parlometron/round] word speak threw:",we)}})})},m=()=>{n==="ready"?S():n==="recording"?F():n==="result"&&y()?(u=null,n="ready",w(),S()):n==="result"&&b()},y=()=>{const g=_t(e.game);return g?(e.game.attemptsLeft[g.id]??0)>0:!1},S=async()=>{if(r||!_t(e.game))return;const $=yr();i=$,u=null,h=null,n="recording",w();try{const C=br((o==null?void 0:o.language_code)??"en"),H=await t.startSession({sessionId:$,language:C,expectedText:(o==null?void 0:o.text)??"",whisperParams:Wt(C)});if(r)return;if(!H.started)throw new Error("STT did not start")}catch(C){console.error("[parlometron/round] startSession failed:",C),i=null,n="ready",w()}},F=async()=>{if(r)return;const g=i;if(g){i=null,n="scoring",w();try{const $=await wr(t.stopSession({sessionId:g}),gr,"Scoring");if(r)return;const C=Math.round(Math.max(0,Math.min(1,$.overallScore))*100),H=$.text||$.freeText||"";lr(e.game,C,H),ht(e.game),u=$,n="result",w()}catch($){const C=($==null?void 0:$.message)??String($),H=$==null?void 0:$.code;if(console.error(`[parlometron/round] stopSession failed (code=${H??"—"}):`,C),r)return;h=H==="NOT_PREPARED"||/not prepared/i.test(C)?"Speech model isn't loaded yet. Open Practice once to install it.":`Couldn't score this attempt: ${C}`,u=null,n="ready",w()}}},b=()=>{if(!r){if(dr(e.game),ht(e.game),pr(e.game)){const{round:g}=fr(e.game);ht(e.game),e.onRoundDone(g);return}u=null,h=null,n="passing",w()}};return(async()=>{var g,$,C;v(),n="loading",w();try{const H=e.hostApi.getStackConfig();if(!H.languages||H.languages.length<2){e.container.innerHTML=`
          <div class="pc-pm-root pc-pm-error">
            <p>Add a target language to your Corpán stack before starting Parlometron.</p>
            <button class="pc-pm-start" data-pm-quit>Back</button>
          </div>`,(g=e.container.querySelector("[data-pm-quit]"))==null||g.addEventListener("click",e.onQuit);return}const ne=e.hostApi.getRandomEntry;if(!ne)throw new Error("hostApi.getRandomEntry unavailable");const B=await ne();if(r)return;const{target:N,native:Y}=Sr(B,H.languages);if(!N){e.container.innerHTML=`
          <div class="pc-pm-root pc-pm-error">
            <p>This phrase doesn't have a translation in your target language.</p>
            <button class="pc-pm-start" data-pm-quit>Back</button>
          </div>`,($=e.container.querySelector("[data-pm-quit]"))==null||$.addEventListener("click",e.onQuit);return}o=N,c=Y,cr(e.game,N.text),ht(e.game),n="passing",w()}catch(H){if(console.error("[parlometron/round] boot failed:",H),r)return;e.container.innerHTML=`
        <div class="pc-pm-root pc-pm-error">
          <p>Couldn't load a phrase. Try again later.</p>
          <button class="pc-pm-start" data-pm-quit>Back</button>
        </div>`,(C=e.container.querySelector("[data-pm-quit]"))==null||C.addEventListener("click",e.onQuit)}})(),{unmount:()=>{r=!0,i&&(t.cancelSession({sessionId:i}).catch(g=>console.error("[parlometron/round] unmount cancel:",g)),i=null),e.container.innerHTML=""}}},_e=e=>e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),rn=(e,t)=>e.players.find(r=>r.id===t),$r=e=>{const{game:t,round:r}=e,n=r.winnerIds.map(u=>{var h;return((h=rn(t,u))==null?void 0:h.name)??"—"}).filter(Boolean),i=n.length===0?"No round winner.":n.length===1?`${n[0]} wins the round`:`${n.join(" & ")} tie for the round`,o=r.results.map(u=>{const h=rn(t,u.playerId),v=r.winnerIds.includes(u.playerId),w=t.roundsWon[u.playerId]??0;return`
        <tr class="${v?"winner":""}">
          <td class="pc-pm-score-name">${_e((h==null?void 0:h.name)??"—")}</td>
          <td class="pc-pm-score-pct">${u.bestPercent}%</td>
          <td class="pc-pm-score-heard">${_e((u.heardText||"—").slice(0,60))}</td>
          <td class="pc-pm-score-total">${w}</td>
        </tr>`}).join("");return e.container.innerHTML=`
    <div class="pc-pm-root pc-pm-results">
      <header class="pc-pm-head">
        <div class="pc-pm-head-eyebrow-row">
          <span class="pc-pm-eyebrow">Round ${r.round} · First to ${t.winTarget}</span>
        </div>
        <div class="pc-pm-head-action-row">
          <button class="pc-pm-back" data-pm-quit aria-label="Quit game">‹</button>
          <span class="pc-pm-headline">${_e(i)}</span>
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
    </div>`,(()=>{var h,v,w;const u=async()=>{await nn({message:"Quit this game?",confirmLabel:"Quit",cancelLabel:"Keep playing",destructive:!0})&&e.onQuit()};(h=e.container.querySelector("[data-pm-quit]"))==null||h.addEventListener("click",u),(v=e.container.querySelector("[data-pm-quit2]"))==null||v.addEventListener("click",u),(w=e.container.querySelector("[data-pm-next]"))==null||w.addEventListener("click",()=>e.onNextRound())})(),{unmount:()=>{e.container.innerHTML=""}}},kr=e=>{var c,u;const{game:t}=e,r=mr(t),n=r.length===0?"Game over":r.length===1?`${r[0].name} wins!`:`${r.map(h=>h.name).join(" & ")} tie!`,o=[...t.players].sort((h,v)=>(t.roundsWon[v.id]??0)-(t.roundsWon[h.id]??0)).map((h,v)=>{const w=t.roundsWon[h.id]??0,D=r.some(S=>S.id===h.id),m=t.history.map(S=>S.results.find(F=>F.playerId===h.id)).filter(S=>!!S),y=m.length?Math.round(m.reduce((S,F)=>S+F.bestPercent,0)/m.length):0;return`
        <tr class="${D?"winner":""}">
          <td class="pc-pm-score-rank">${v+1}</td>
          <td class="pc-pm-score-name">${_e(h.name)}</td>
          <td class="pc-pm-score-total">${w}</td>
          <td class="pc-pm-score-pct">${y}%</td>
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
    </div>`,(c=e.container.querySelector("[data-pm-done]"))==null||c.addEventListener("click",()=>e.onDone()),(u=e.container.querySelector("[data-pm-again]"))==null||u.addEventListener("click",()=>e.onPlayAgain()),{unmount:()=>{e.container.innerHTML=""}}},Mr="pc:parlometron:last-mode",Tr="corpan-pronunciation-coach:v2",Er=()=>{let e=null;try{const t=localStorage.getItem(Tr);if(t){const r=JSON.parse(t),n=ue(r.mode);n&&(e=n.folder)}}catch(t){console.warn("[parlometron] reading saved model failed:",t)}return e??Ft().folder},xr=e=>{const t=e.stt;if(!(t!=null&&t.prepare))return;const r=Er();console.log("[parlometron] ensureModelPrepared — calling prepare:",r),t.prepare({model:r}).then(n=>{n.ready?console.log(`[parlometron] model ready: ${n.model??r}`):console.warn(`[parlometron] prepare reported not ready (code=${n.code??"—"}): ${n.message??""}`)}).catch(n=>{console.warn("[parlometron] prepare threw:",n)})},_r=(e,t)=>{let r=null,n=null,i=null;const o=()=>{if(r){try{r.unmount()}catch(m){console.error("[parlometron] unmount threw:",m)}r=null}},c=()=>{var m;o(),n=null,e.innerHTML=`
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
      </div>`,(m=e.querySelector("[data-pm-picker-close]"))==null||m.addEventListener("click",()=>{try{window.dispatchEvent(new CustomEvent("corpan:exit"))}catch(y){console.error("[parlometron] dispatch exit failed:",y)}}),e.querySelectorAll("[data-pm-mode]").forEach(y=>y.addEventListener("click",()=>{const S=y.getAttribute("data-pm-mode");try{localStorage.setItem(Mr,S??"")}catch{}S==="practice"?u():S==="friends"&&(Ge(),h(i??void 0))})),r={unmount:()=>{e.innerHTML=""}}},u=()=>{o(),r=ar(e,t,{onClose:()=>c()})},h=m=>{o(),r=hr({container:e,onBack:()=>c(),onStart:S=>{n=S,i={players:S.players.map(F=>({...F})),winTarget:S.winTarget},v()},initial:m})},v=()=>{if(!n){c();return}o(),r=Lr({container:e,hostApi:t,game:n,onRoundDone:y=>{n&&(ur(n)?D():w(y))},onQuit:()=>{Ge(),n=null,c()}})},w=m=>{if(!n){c();return}o(),r=$r({container:e,game:n,round:m,onNextRound:()=>v(),onQuit:()=>{Ge(),n=null,c()}})},D=()=>{if(!n){c();return}o(),r=kr({container:e,game:n,onPlayAgain:()=>{const y=i;Ge(),n=null,h(y??void 0)},onDone:()=>{Ge(),n=null,c()}})};return xr(t),c(),{unmount:()=>{var y;o(),e.innerHTML="";const m=t.stt;(y=m==null?void 0:m.releaseAudio)==null||y.call(m).catch(S=>{console.error("[parlometron] releaseAudio failed:",S)})}}},Cr="/__console",Rr="8990";function qr(){var r,n;if(typeof document>"u")return null;const e=((n=(r=document.currentScript)==null?void 0:r.dataset)==null?void 0:n.corpGameBaseUrl)??null;if(!e)return null;let t;try{t=new URL(e)}catch{return null}return t.protocol!=="http:"?null:`${t.protocol}//${t.hostname}:${Rr}${Cr}`}function Ir(e){if(e==null||typeof e=="string"||typeof e=="number"||typeof e=="boolean")return e;if(e instanceof Error)return{__error:!0,name:e.name,message:e.message,stack:e.stack};try{return JSON.stringify(e),e}catch{try{return String(e)}catch{return"[unserializable]"}}}let an=!1;function Pr(){if(an)return;const e=qr();if(!e)return;an=!0;const t={log:console.log.bind(console),info:console.info.bind(console),warn:console.warn.bind(console),error:console.error.bind(console)},r=(i,o)=>{try{const c=JSON.stringify({level:i,args:o.map(Ir),ts:Date.now()});fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:c,keepalive:!0}).catch(()=>{})}catch{}},n=i=>(...o)=>{r(i,o),t[i](...o)};console.log=n("log"),console.info=n("info"),console.warn=n("warn"),console.error=n("error"),typeof window<"u"&&(window.addEventListener("error",i=>{r("error",["[unhandled error]",i.message,i.filename,`${i.lineno}:${i.colno}`])}),window.addEventListener("unhandledrejection",i=>{r("error",["[unhandled rejection]",String(i.reason)])})),t.log(`[devConsole] forwarding to ${e}`)}Pr();const Ar="pronunciation_coach";(()=>{const e=globalThis,t=e.CorpanGames=e.CorpanGames||{};t[Ar]={mount:(r,n,i)=>{const o=globalThis;o.__pronunciationCoach&&(o.__pronunciationCoach.dispose(),o.__pronunciationCoach=void 0);const c=_r(r,n),u={dispose:()=>{c.unmount()}};return o.__pronunciationCoach=u,{unmount:()=>{u.dispose(),o.__pronunciationCoach=void 0}}}}})()})();
