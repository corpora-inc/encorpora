#!/usr/bin/env /home/skyl/tts_venv/bin/python
"""
Verify the 30 codex-edited (fi + hi) resyncs for heart / ian-chatterbox-v1.

Serves a single-page web app with per-segment audio + verdicts.
Verdicts persist to /tmp/heart_resync_verdicts.json.

Run:
  /home/skyl/encorpora/books/science/fascinating-science/016-the-human-heart/scripts/verify_resync_web.py
Then open: http://localhost:8765
"""
import json, os, sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs

PORT = 8765
PACK = Path("/home/skyl/encorpora/books/science/fascinating-science/016-the-human-heart/packs/ian-chatterbox-v1")
VERDICT_FILE = Path("/tmp/heart_resync_verdicts.json")

# Codex edits, mapped {(lang, seg_id): (before_tts, after_tts)}
FI_EDITS = {
    "ch02-079": ("Keuhko- tarkoittaa keuhkoihin liittyvää.",                    "Keuhko tarkoittaa keuhkoihin liittyvää."),
    "ch02-097": ("Sydämenlyönnin ääni lub-dub johtuu sulkeutuvista läpistä.",   "Sydämenlyönnin ääni lub dub johtuu sulkeutuvista läpistä."),
    "ch03-140": ("Kuona-aineet kulkevat sisään.",                                "Kuonaaineet kulkevat sisään."),
    "ch04-157": ("Sitä kutsutaan yleensä SA-solmukkeeksi.",                      "Sitä kutsutaan yleensä ässä aa solmukkeeksi."),
    "ch04-160": ("SA-solmuke tuottaa sähköisiä impulsseja.",                     "ässä aa solmuke tuottaa sähköisiä impulsseja."),
    "ch04-163": ("SA-solmuke laukeaa noin kuudestakymmenestä sataan kertaa minuutissa levossa olevalla aikuisella.",
                 "ässä aa solmuke laukeaa noin kuudestakymmenestä sataan kertaa minuutissa levossa olevalla aikuisella."),
    "ch04-167": ("Impulssi saavuttaa sitten toisen solmukkeen, jota kutsutaan eteis-kammiosolmukkeeksi.",
                 "Impulssi saavuttaa sitten toisen solmukkeen, jota kutsutaan eteiskammiosolmukkeeksi."),
    "ch04-168": ("Sitä kutsutaan AV-solmukkeeksi.",                              "Sitä kutsutaan aa vee solmukkeeksi."),
    "ch04-169": ("AV-solmuke sijaitsee eteisten ja kammioiden välissä.",         "aa vee solmuke sijaitsee eteisten ja kammioiden välissä."),
    "ch04-170": ("Se pysäyttää signaalin murto-osaksi sekunnista.",              "Se pysäyttää signaalin murto osaksi sekunnista.  [ROUND 2: reverted merge to space; round 1 was murtoosaksi → user heard broken]"),
    "ch04-181": ("...supistumis- ja rentoutumissykliä...",                       "...supistumis ja rentoutumissykliä..."),
    "ch04-195": ("Jos SA-solmuke pettää...",                                     "Jos ässä aa solmuke pettää..."),
    "ch06-276": ("...HDL-kolesterolitasoja.",                                    "...hoo dee äl kolesterolitasoja."),
    "ch07-307": ("Se taipuu S-muotoon.",                                         "Se taipuu ässä muotoon."),
    "ch08-350": ("Vauva-iässä sydän...",                                         "Vauvaiässä sydän..."),
    "ch08-391": ("...Etelä-Afrikassa.",                                          "...Etelä Afrikassa."),
}
HI_EDITS = {
    "ch01-018": ("...सिकुड़ती है — आपके...",                                       "...सिकुड़ती है, आपके..."),
    "ch02-083": ("...ऑक्सीजन-युक्त रक्त...",                                       "...ऑक्सीजन युक्त रक्त..."),
    "ch02-097": ("...आवाज़ लब-डब वाल्वों...",                                       "...आवाज़ लब डब वाल्वों..."),
    "ch03-111": ("...धमनी और दूर — दोनों...ऑक्सीजन-युक्त रक्त...",                 "...धमनी और दूर, दोनों...ऑक्सीजन युक्त रक्त..."),
    "ch03-137": ("...आस-पास के ऊतक...",                                          "...आस पास के ऊतक..."),
    "ch03-141": ("सारा आदान-प्रदान...",                                           "सारा आदान प्रदान..."),
    "ch03-150": ("केशिकाएँ आदान-प्रदान करती हैं।",                                  "केशिकाएँ आदानप्रदान करती हैं।  [ROUND 2: merged compound; round 1 was आदान प्रदान → user heard broken]"),
    "ch04-159": ("...पास-पास की चीज़ों...",                                        "...पास पास की चीज़ों..."),
    "ch05-213": ("...दबाव-मापक उपकरणों...",                                       "...दबाव मापक उपकरणों..."),
    "ch05-218": ("फिर कफ धीरे-धीरे पिचकता है।",                                    "फिर कफ धीरेधीरे पिचकता है।  [ROUND 2: merged reduplication per your 'repetition' note; round 1 was धीरे धीरे spaced → broken]"),
    "ch06-277": ("एचडीएल का अर्थ है हाई-डेंसिटी लिपोप्रोटीन।",                       "एच डी एल का अर्थ है हाईडेंसिटी लिपोप्रोटीन।  [ROUND 2: expand acronym + merge compound; round 1 was हाई डेंसिटी → mid-phrase 3s gap. Still failing as of round 2 resync — may need round 3]"),
    "ch07-338": ("कभी-कभी ये संरचनाएँ...",                                         "कभी कभी ये संरचनाएँ..."),
    "ch08-355": ("जैसे-जैसे बच्चा...",                                              "जैसे जैसे बच्चा..."),
    "ch08-356": ("हृदय गति धीरे-धीरे धीमी होती जाती है।",                            "हृदय गति धीरेधीरे धीमी होती जाती है।  [ROUND 2: merged reduplication per your 'repetition' note; round 1 was धीरे धीरे spaced → broken]"),
}

# Segments that FAILED resync (RETRY status). User needs to verdict whether
# the validator complaint is real or a calibration false-positive.
RETRY_SEGS = {"hi": {"ch03-150", "ch06-277"}}

# Load segments to get full display text + tts.text
def load_segments(lang):
    p = PACK / f"segments_{lang}.json"
    data = json.load(p.open())
    return {s["id"]: s for s in data["segments"]}

# Load pipeline state for retry-segment error context
def load_pipeline_state(lang):
    p = PACK / f"pipeline_state_{lang}.json"
    return json.load(p.open())

FI_SEGS = load_segments("fi")
HI_SEGS = load_segments("hi")
FI_STATE = load_pipeline_state("fi")
HI_STATE = load_pipeline_state("hi")


def load_verdicts():
    if VERDICT_FILE.exists():
        raw = json.loads(VERDICT_FILE.read_text())
        # Migrate legacy string verdicts to {verdict, notes} dict shape
        migrated = {}
        for k, v in raw.items():
            if isinstance(v, str):
                migrated[k] = {"verdict": v, "notes": ""}
            else:
                migrated[k] = v
        return migrated
    return {}


def save_verdicts(v):
    VERDICT_FILE.write_text(json.dumps(v, indent=2, ensure_ascii=False))


def err_summary(state_entry):
    verrs = (state_entry or {}).get("validation_errors") or []
    out = []
    for e in verrs:
        if isinstance(e, dict):
            out.append(f"{e.get('type','?')}: {e.get('message','')[:140]}")
        else:
            out.append(str(e)[:140])
    return out


def render_page(verdicts):
    rows = []
    counts = {"fine": 0, "broken": 0, "unset": 0}

    def render_row(lang, sid, before, after, segs, state):
        seg = segs.get(sid, {})
        text = seg.get("text", "")
        tts_now = (seg.get("tts") or {}).get("text", "")
        verdict_key = f"{lang}_{sid}"
        entry = verdicts.get(verdict_key) or {}
        v = entry.get("verdict", "unset")
        notes = entry.get("notes", "")
        counts[v] = counts.get(v, 0) + 1
        retry = sid in RETRY_SEGS.get(lang, set())
        retry_html = ""
        if retry:
            errs = err_summary(state.get(sid))
            errs_html = "".join(f"<li><code>{e}</code></li>" for e in errs)
            retry_html = (
                f'<div class="retry-box">'
                f'<strong>⚠ RESYNC RETRY (validator complaint, not yet DONE):</strong>'
                f'<ul>{errs_html}</ul>'
                f'<em>Listen and decide: is the audio actually broken, '
                f'or is this a false-positive (e.g., language_leak: detected=ur '
                f'is a known Indic-script Whisper artifact)?</em>'
                f'</div>'
            )
        # Audio fallback: m4a → best.wav → wav
        m4a = PACK / "audio" / lang / f"{sid}.m4a"
        best_wav = PACK / "audio" / lang / "wav" / f"{sid}.best.wav"
        wav = PACK / "audio" / lang / "wav" / f"{sid}.wav"
        if m4a.exists():
            audio_html = f'<audio controls preload="none" src="/audio/{lang}/{sid}.m4a"></audio>'
        elif best_wav.exists():
            audio_html = f'<audio controls preload="none" src="/audio/{lang}/wav/{sid}.best.wav"></audio><div class="audio-note">⚠ best-attempt WAV (didn\'t pass validator)</div>'
        elif wav.exists():
            audio_html = f'<audio controls preload="none" src="/audio/{lang}/wav/{sid}.wav"></audio><div class="audio-note">⚠ latest WAV (last failed attempt)</div>'
        else:
            audio_html = (
                '<div class="no-audio">⚠ no audio on disk at all.</div>'
            )
        # Escape notes for HTML attribute
        notes_attr = notes.replace('"', '&quot;').replace('<', '&lt;')
        row_class = "row" + (" retry" if retry else "")
        return f"""
        <div class="{row_class}" id="{verdict_key}">
            <h3>{lang.upper()} <code>{sid}</code> <span class="verdict-tag v-{v}">{v}</span></h3>
            <div class="text-block">
                <div class="label">display <code>text</code> (reader sees):</div>
                <div class="content">{text}</div>
            </div>
            <div class="text-block">
                <div class="label">tts.text NOW (Chatterbox spoke this):</div>
                <div class="content">{tts_now}</div>
            </div>
            <div class="text-block diff">
                <div class="label">codex edit (was → now):</div>
                <div class="content"><span class="before">{before}</span> → <span class="after">{after}</span></div>
            </div>
            {retry_html}
            {audio_html}
            <textarea class="notes" id="notes_{verdict_key}" placeholder="notes (what's wrong, what to try, Chatterbox failure-mode you heard...)"
                      oninput="markDirty('{verdict_key}')">{notes_attr}</textarea>
            <div class="buttons">
                <button class="btn save"   onclick="saveNotes('{verdict_key}')">💾 Save notes</button>
                <span class="save-status" id="status_{verdict_key}"></span>
            </div>
            <div class="buttons">
                <button class="btn fine"   onclick="verdict('{verdict_key}','fine')">✓ FINE — ship it</button>
                <button class="btn broken" onclick="verdict('{verdict_key}','broken')">✗ BROKEN — fix tts.text again</button>
                <button class="btn unset"  onclick="verdict('{verdict_key}','unset')">reset</button>
            </div>
        </div>
        """

    rows.append("<h2>Finnish (fi) — 16 segments resynced cleanly (DONE)</h2>")
    for sid in sorted(FI_EDITS.keys()):
        before, after = FI_EDITS[sid]
        rows.append(render_row("fi", sid, before, after, FI_SEGS, FI_STATE))

    rows.append("<h2>Hindi (hi) — 12 DONE + 2 RETRY (validator didn't accept)</h2>")
    for sid in sorted(HI_EDITS.keys()):
        before, after = HI_EDITS[sid]
        rows.append(render_row("hi", sid, before, after, HI_SEGS, HI_STATE))

    total = sum(counts.values())
    return f"""<!DOCTYPE html><html><head>
    <meta charset="utf-8"><title>Heart fi+hi resync verdicts</title>
    <style>
      body {{ font-family: -apple-system, system-ui, sans-serif; max-width: 900px; margin: 2em auto; padding: 0 1em; background: #fafafa; color: #222; }}
      h1 {{ color: #b22; }}
      h2 {{ margin-top: 2em; border-bottom: 2px solid #888; }}
      .summary {{ position: sticky; top: 0; background: #fff; padding: 1em; border: 2px solid #444; margin-bottom: 1em; z-index: 10; }}
      .row {{ background: #fff; border: 1px solid #ccc; padding: 1em; margin: 1em 0; border-radius: 6px; }}
      .row.retry {{ background: #fff8e6; border-color: #e6b800; }}
      .label {{ font-size: 0.85em; color: #666; margin-top: 0.5em; }}
      .content {{ font-size: 1.1em; padding: 0.3em 0; }}
      .diff .before {{ background: #ffe0e0; padding: 2px 4px; text-decoration: line-through; }}
      .diff .after  {{ background: #e0ffe0; padding: 2px 4px; font-weight: bold; }}
      .retry-box {{ background: #fff4cc; border-left: 4px solid #e6b800; padding: 0.7em 1em; margin: 0.7em 0; font-size: 0.95em; }}
      .retry-box ul {{ margin: 0.3em 0; padding-left: 1.5em; }}
      audio {{ width: 100%; margin-top: 0.5em; }}
      .no-audio {{ background: #f4d4d4; border: 1px dashed #d44; color: #800; padding: 0.6em; margin-top: 0.5em; border-radius: 4px; font-size: 0.9em; }}
      .audio-note {{ font-size: 0.8em; color: #666; margin-top: 0.2em; }}
      textarea.notes {{ width: 100%; min-height: 2.5em; margin-top: 0.5em; font-family: inherit; padding: 0.4em; border: 1px solid #aaa; border-radius: 4px; }}
      .buttons {{ margin-top: 0.6em; }}
      .btn {{ padding: 0.4em 0.9em; margin-right: 0.4em; border: 1px solid #888; border-radius: 4px; cursor: pointer; font-size: 0.95em; }}
      .btn.fine   {{ background: #d4f4dd; }}
      .btn.broken {{ background: #fcd4d4; }}
      .btn.unset  {{ background: #eee; }}
      .btn.save   {{ background: #ddeeff; }}
      .save-status {{ font-size: 0.85em; color: #666; margin-left: 0.5em; }}
      .save-status.dirty {{ color: #c70; font-weight: bold; }}
      .save-status.saved {{ color: #4a4; }}
      .verdict-tag {{ display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 0.8em; vertical-align: middle; margin-left: 0.5em; }}
      .v-fine   {{ background: #4d9; color: white; }}
      .v-broken {{ background: #d44; color: white; }}
      .v-unset  {{ background: #bbb; color: white; }}
    </style></head><body>
    <h1>Heart fi + hi — verdict the 30 codex-edited segments</h1>
    <div class="summary">
      <strong>Progress:</strong>
      ✓ fine: {counts.get('fine',0)} |
      ✗ broken: {counts.get('broken',0)} |
      unset: {counts.get('unset',0)} |
      total: {total}
      <br>Verdicts saved to <code>{VERDICT_FILE}</code>.
      When all fine: ship fi + hi. When any broken: re-fix tts.text (codex again or hand) and re-resync.
      <br><strong>Yellow RETRY rows</strong> need extra attention — validator flagged them, you decide if it's a real defect.
    </div>
    {''.join(rows)}
    <script>
      const saveTimers = {{}};

      function markDirty(key) {{
        const s = document.getElementById('status_' + key);
        if (s) {{ s.textContent = '● unsaved'; s.className = 'save-status dirty'; }}
        if (saveTimers[key]) clearTimeout(saveTimers[key]);
        saveTimers[key] = setTimeout(() => saveNotes(key), 1200);
      }}

      async function saveNotes(key) {{
        if (saveTimers[key]) {{ clearTimeout(saveTimers[key]); delete saveTimers[key]; }}
        const ta = document.getElementById('notes_' + key);
        const s = document.getElementById('status_' + key);
        if (!ta) return;
        // URL-encoded body (server uses parse_qs which only handles x-www-form-urlencoded)
        const body = new URLSearchParams();
        body.append('key', key);
        body.append('notes', ta.value);
        try {{
          const r = await fetch('/notes', {{
            method: 'POST',
            headers: {{'Content-Type': 'application/x-www-form-urlencoded'}},
            body: body.toString(),
          }});
          if (r.ok) {{
            if (s) {{ s.textContent = '✓ saved ' + new Date().toLocaleTimeString(); s.className = 'save-status saved'; }}
          }} else if (s) {{ s.textContent = '✗ save FAILED (HTTP ' + r.status + ')'; s.className = 'save-status dirty'; }}
        }} catch (e) {{
          if (s) {{ s.textContent = '✗ save FAILED: ' + e.message; s.className = 'save-status dirty'; }}
        }}
      }}

      async function verdict(key, v) {{
        // FLUSH any pending notes save FIRST, await it, then verdict + reload
        await saveNotes(key);
        const r = await fetch('/verdict?key=' + encodeURIComponent(key) + '&v=' + v, {{method:'POST'}});
        await r.json();
        location.reload();
      }}

      window.addEventListener('beforeunload', () => {{
        for (const key in saveTimers) {{
          const ta = document.getElementById('notes_' + key);
          if (ta) {{
            const body = new URLSearchParams();
            body.append('key', key);
            body.append('notes', ta.value);
            // sendBeacon needs a Blob with explicit content-type for the server to parse
            const blob = new Blob([body.toString()], {{type: 'application/x-www-form-urlencoded'}});
            navigator.sendBeacon('/notes', blob);
          }}
        }}
      }});
    </script>
    </body></html>"""


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args, **kwargs):
        pass

    def do_GET(self):
        u = urlparse(self.path)
        if u.path == "/" or u.path == "/index.html":
            v = load_verdicts()
            body = render_page(v).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
            self.send_header("Pragma", "no-cache")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if u.path.startswith("/audio/"):
            # /audio/<lang>/<id>.m4a  OR  /audio/<lang>/wav/<id>.wav
            parts = u.path.lstrip("/").split("/")
            f = None
            if len(parts) == 3:
                f = PACK / "audio" / parts[1] / parts[2]
            elif len(parts) == 4 and parts[2] == "wav":
                f = PACK / "audio" / parts[1] / "wav" / parts[3]
            if f is not None and f.exists():
                ext = f.suffix.lower()
                mime = "audio/wav" if ext == ".wav" else "audio/mp4"
                self.send_response(200)
                self.send_header("Content-Type", mime)
                self.send_header("Content-Length", str(f.stat().st_size))
                self.send_header("Accept-Ranges", "bytes")
                self.end_headers()
                self.wfile.write(f.read_bytes())
                return
            self.send_error(404)
            return
        self.send_error(404)

    def do_POST(self):
        u = urlparse(self.path)
        if u.path == "/verdict":
            q = parse_qs(u.query)
            key = q.get("key", [None])[0]
            v = q.get("v", [None])[0]
            if key and v in ("fine", "broken", "unset"):
                verdicts = load_verdicts()
                entry = verdicts.get(key) or {}
                if not isinstance(entry, dict):
                    entry = {"verdict": entry, "notes": ""}
                entry["verdict"] = v
                entry.setdefault("notes", "")
                verdicts[key] = entry
                save_verdicts(verdicts)
                body = json.dumps({"ok": True, "key": key, "v": v}).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
        if u.path == "/notes":
            length = int(self.headers.get("Content-Length", "0"))
            body_in = self.rfile.read(length).decode("utf-8", errors="replace")
            form = parse_qs(body_in)
            key = form.get("key", [None])[0]
            notes = form.get("notes", [""])[0]
            if key:
                verdicts = load_verdicts()
                entry = verdicts.get(key) or {}
                if not isinstance(entry, dict):
                    entry = {"verdict": entry, "notes": ""}
                entry["notes"] = notes
                entry.setdefault("verdict", "unset")
                verdicts[key] = entry
                save_verdicts(verdicts)
                body = json.dumps({"ok": True, "key": key}).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
        self.send_error(400)


if __name__ == "__main__":
    print(f"\n  Heart fi+hi resync verdict tool")
    print(f"  ────────────────────────────────")
    print(f"  Open (tailscale):")
    print(f"    http://spark-f62c:{PORT}")
    print(f"    http://spark-f62c.tail3c0d12.ts.net:{PORT}")
    print(f"    http://100.99.83.64:{PORT}")
    print(f"  Verdicts saved to: {VERDICT_FILE}")
    print(f"  Ctrl-C to stop.\n")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
