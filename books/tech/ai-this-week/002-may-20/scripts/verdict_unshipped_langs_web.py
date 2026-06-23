#!/usr/bin/env /home/skyl/tts_venv/bin/python
"""
AITW Episode 2 (vindy-ron-gemini-v1) — verdict tool for the 239 stuck/failed
segments across 15 unshipped langs. The pack is all-Gemini.

Per-lang collapsible sections, free-text notes, missing-audio fallback,
tailscale-accessible.

Run:
  /home/skyl/encorpora/books/tech/ai-this-week/002-may-20/scripts/verdict_unshipped_langs_web.py
Then open: http://spark-f62c:8766
"""
import json, html, sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs

PORT = 8766
PACK = Path("/home/skyl/encorpora/books/tech/ai-this-week/002-may-20/packs/vindy-ron-gemini-v1")
VERDICT_FILE = Path("/tmp/aitw_ep2_verdicts.json")

# 15 unshipped langs: explicitly escalated in queue + the others with FAILED/RETRY
ESCALATED = ["es", "ar", "pt", "fr", "ru", "de", "it", "hi"]
OTHER     = ["ca", "gu", "kn", "ms", "sw", "ta", "th"]
ALL_LANGS = ESCALATED + OTHER


def load_verdicts():
    if VERDICT_FILE.exists():
        raw = json.loads(VERDICT_FILE.read_text())
        out = {}
        for k, v in raw.items():
            out[k] = v if isinstance(v, dict) else {"verdict": v, "notes": ""}
        return out
    return {}


def save_verdicts(v):
    VERDICT_FILE.write_text(json.dumps(v, indent=2, ensure_ascii=False))


# Per-lang segment dicts + pipeline state — fresh load each request so
# segs that get cleared via the calibrate-and-ship flow stop showing here.
def load_lang(lang):
    try:
        segs = json.load((PACK / f"segments_{lang}.json").open())["segments"]
        state = json.load((PACK / f"pipeline_state_{lang}.json").open())
    except FileNotFoundError:
        return {}, {}, []
    seg_map = {s["id"]: s for s in segs}
    problem_ids = []
    for sid, s in state.items():
        if not isinstance(s, dict): continue
        if s.get("status") in ("FAILED", "RETRY"):
            problem_ids.append(sid)
    problem_ids.sort()
    return seg_map, state, problem_ids


def get_lang_data():
    """Fresh per-request snapshot of all langs' problem segs."""
    return {L: load_lang(L) for L in ALL_LANGS}


def err_summary(state_entry):
    verrs = (state_entry or {}).get("validation_errors") or []
    out = []
    for e in verrs:
        if isinstance(e, dict):
            out.append(f"{e.get('type','?')}: {(e.get('message','') or '')[:200]}")
        else:
            out.append(str(e)[:200])
    return out


def render_seg(lang, sid, seg_map, state, verdicts):
    seg = seg_map.get(sid, {})
    text = seg.get("text", "")
    tts_text = (seg.get("tts") or {}).get("text", "")
    speaker = seg.get("speaker", "?")
    key = f"{lang}_{sid}"
    entry = verdicts.get(key) or {}
    v = entry.get("verdict", "unset")
    notes = entry.get("notes", "")

    st_entry = state.get(sid, {}) or {}
    status = st_entry.get("status", "?")
    retry_n = st_entry.get("retry_count", "?")
    plateau = st_entry.get("plateau_count", "?")
    score = st_entry.get("best_quality_score", "?")
    errs = err_summary(st_entry)
    errs_html = "".join(f"<li><code>{html.escape(e)}</code></li>" for e in errs)

    # Audio fallback chain: validated m4a → best.wav → latest wav → none
    m4a = PACK / "audio" / lang / f"{sid}.m4a"
    best_wav = PACK / "audio" / lang / "wav" / f"{sid}.best.wav"
    wav = PACK / "audio" / lang / "wav" / f"{sid}.wav"
    if m4a.exists():
        audio_html = f'<audio controls preload="none" src="/audio/{lang}/{sid}.m4a"></audio><div class="audio-note">✓ validated m4a</div>'
    elif best_wav.exists():
        audio_html = f'<audio controls preload="none" src="/audio/{lang}/wav/{sid}.best.wav"></audio><div class="audio-note">⚠ best attempt WAV (didn\'t pass validator — listen to judge if real defect)</div>'
    elif wav.exists():
        audio_html = f'<audio controls preload="none" src="/audio/{lang}/wav/{sid}.wav"></audio><div class="audio-note">⚠ latest WAV (last failed attempt)</div>'
    else:
        audio_html = '<div class="no-audio">⚠ no audio on disk at all — Gemini never produced output.</div>'

    notes_attr = html.escape(notes or "", quote=True)

    return f"""
    <div class="row v-{v}" id="{key}">
        <h4>
            <code>{sid}</code>
            <span class="speaker">[{speaker}]</span>
            <span class="status status-{status}">{status}</span>
            <span class="meta">retry={retry_n} plateau={plateau} score={score}</span>
            <span class="verdict-tag v-{v}">{v}</span>
        </h4>
        <div class="text-block">
            <div class="label">display text:</div>
            <div class="content">{html.escape(text)}</div>
        </div>
        <div class="text-block">
            <div class="label">tts.text (what Gemini was given):</div>
            <div class="content">{html.escape(tts_text)}</div>
        </div>
        <div class="text-block">
            <div class="label">validator complaints ({len(errs)}):</div>
            <ul class="errs">{errs_html}</ul>
        </div>
        {audio_html}
        <textarea class="notes" id="notes_{key}" placeholder="notes (what's wrong, Gemini failure-mode you heard, retry/rewrite/calibrate?)"
                  oninput="markDirty('{key}')">{notes_attr}</textarea>
        <div class="buttons">
            <button class="btn save"   onclick="saveNotes('{key}')" id="save_{key}">💾 Save notes</button>
            <span class="save-status" id="status_{key}"></span>
        </div>
        <div class="buttons">
            <button class="btn fine"   onclick="verdict('{key}','fine')">✓ FINE — false positive, ship as-is</button>
            <button class="btn broken" onclick="verdict('{key}','broken')">✗ BROKEN — real defect</button>
            <button class="btn unsure" onclick="verdict('{key}','unsure')">? UNSURE</button>
            <button class="btn unset"  onclick="verdict('{key}','unset')">reset</button>
        </div>
    </div>
    """


def _no_problems_page():
    return """<!DOCTYPE html><html><head>
    <meta charset="utf-8"><title>AITW ep2 — all clear</title>
    <style>
      body {{ font-family: -apple-system, system-ui, sans-serif; max-width: 700px; margin: 4em auto; padding: 2em; text-align: center; background: #fafafa; color: #222; }}
      .check {{ font-size: 5em; color: #4a4; }}
      h1 {{ color: #4a4; }}
    </style></head><body>
    <div class="check">✓</div>
    <h1>AITW ep2 — all problem segs cleared</h1>
    <p>No language has any FAILED or RETRY segments in pipeline_state right now.<br>
    Either everything's shipped, or the recalibrate flow auto-cleared everything.</p>
    <p>Check the live CDN catalog for current ship state:<br>
    <code>curl -s https://d38iwc9748jekz.cloudfront.net/catalog-v2.json | jq '.narrations[] | select(.bookId | contains("ai_this_week_2026_05_20")) | {id, version}'</code></p>
    </body></html>""".replace("{{","{").replace("}}","}")


def render_page(verdicts, focus_lang=None):
    LANG_DATA = get_lang_data()
    # Top nav with per-lang progress
    nav_items = []
    counts_per_lang = {}
    overall = {"fine": 0, "broken": 0, "unsure": 0, "unset": 0}
    # Only show langs that actually have problem segs right now
    active_langs = [L for L in ALL_LANGS if LANG_DATA[L][2]]
    if not active_langs:
        return _no_problems_page()
    for L in active_langs:
        _, _, problem_ids = LANG_DATA[L]
        c = {"fine": 0, "broken": 0, "unsure": 0, "unset": 0}
        for sid in problem_ids:
            v = (verdicts.get(f"{L}_{sid}") or {}).get("verdict", "unset")
            c[v] = c.get(v, 0) + 1
            overall[v] = overall.get(v, 0) + 1
        counts_per_lang[L] = c
        verdicted = c["fine"] + c["broken"] + c["unsure"]
        total = len(problem_ids)
        cls = "nav-link"
        if L == focus_lang: cls += " active"
        if verdicted == total and total > 0: cls += " done"
        escalated = "★ " if L in ESCALATED else ""
        nav_items.append(
            f'<a href="?lang={L}" class="{cls}">{escalated}{L}'
            f' <span class="prog">{verdicted}/{total}</span></a>'
        )
    nav_html = "  ".join(nav_items)

    # Render only the focus lang section. If focus lang has no problem segs
    # any more, switch to whichever active lang has the fewest unverdicted segs.
    if focus_lang is None or focus_lang not in active_langs:
        unverdicted_counts = sorted(
            [(L, len(LANG_DATA[L][2]) - counts_per_lang[L]["fine"]
                                       - counts_per_lang[L]["broken"]
                                       - counts_per_lang[L]["unsure"]) for L in active_langs],
            key=lambda kv: (kv[1] == 0, kv[1])
        )
        focus_lang = unverdicted_counts[0][0] if unverdicted_counts else active_langs[0]

    seg_map, state, problem_ids = LANG_DATA[focus_lang]
    rows = []
    for sid in problem_ids:
        rows.append(render_seg(focus_lang, sid, seg_map, state, verdicts))

    total_problem = sum(len(LANG_DATA[L][2]) for L in active_langs)
    verdicted_total = overall["fine"] + overall["broken"] + overall["unsure"]

    return f"""<!DOCTYPE html><html><head>
    <meta charset="utf-8"><title>AITW ep2 — verdict 239 stuck segs</title>
    <style>
      body {{ font-family: -apple-system, system-ui, sans-serif; max-width: 980px; margin: 1em auto; padding: 0 1em; background: #fafafa; color: #222; }}
      h1 {{ color: #b22; margin: 0.3em 0; }}
      .sticky {{ position: sticky; top: 0; background: #fff; padding: 0.7em; border-bottom: 2px solid #444; z-index: 10; }}
      nav {{ margin-top: 0.5em; line-height: 2; }}
      .nav-link {{ display: inline-block; padding: 0.3em 0.7em; margin: 0.15em; border: 1px solid #aaa; border-radius: 4px; text-decoration: none; color: #333; background: #fff; }}
      .nav-link.active {{ background: #b22; color: white; border-color: #b22; font-weight: bold; }}
      .nav-link.done {{ background: #cfc; border-color: #4a4; }}
      .prog {{ font-size: 0.8em; opacity: 0.7; }}
      .lang-header {{ margin-top: 1em; border-bottom: 2px solid #888; padding-bottom: 0.5em; }}
      .row {{ background: #fff; border: 1px solid #ccc; padding: 0.9em; margin: 0.8em 0; border-radius: 6px; }}
      .row.v-fine {{ border-left: 5px solid #4d9; }}
      .row.v-broken {{ border-left: 5px solid #d44; }}
      .row.v-unsure {{ border-left: 5px solid #ea0; }}
      .row.v-unset {{ border-left: 5px solid #bbb; }}
      .row h4 {{ margin: 0 0 0.4em 0; font-size: 1em; }}
      .speaker {{ color: #666; font-size: 0.85em; margin-left: 0.3em; }}
      .status {{ font-size: 0.75em; padding: 1px 6px; border-radius: 8px; background: #eee; margin-left: 0.5em; }}
      .status-FAILED {{ background: #fcd; color: #800; }}
      .status-RETRY {{ background: #ffd; color: #850; }}
      .meta {{ font-size: 0.75em; color: #888; margin-left: 0.5em; }}
      .label {{ font-size: 0.8em; color: #666; margin-top: 0.4em; }}
      .content {{ font-size: 1.05em; padding: 0.2em 0; }}
      .errs {{ margin: 0.3em 0; padding-left: 1.5em; font-size: 0.85em; }}
      audio {{ width: 100%; margin-top: 0.4em; }}
      .no-audio {{ background: #fde4e4; border: 1px dashed #d44; color: #800; padding: 0.5em; margin-top: 0.4em; border-radius: 4px; font-size: 0.9em; }}
      textarea.notes {{ width: 100%; min-height: 2.3em; margin-top: 0.4em; font-family: inherit; padding: 0.35em; border: 1px solid #aaa; border-radius: 4px; }}
      .buttons {{ margin-top: 0.5em; }}
      .btn {{ padding: 0.3em 0.7em; margin-right: 0.3em; border: 1px solid #888; border-radius: 4px; cursor: pointer; font-size: 0.85em; }}
      .btn.fine   {{ background: #d4f4dd; }}
      .btn.broken {{ background: #fcd4d4; }}
      .btn.unsure {{ background: #fde7b8; }}
      .btn.unset  {{ background: #eee; }}
      .btn.save   {{ background: #ddeeff; }}
      .save-status {{ font-size: 0.8em; color: #666; margin-left: 0.5em; }}
      .save-status.dirty {{ color: #c70; font-weight: bold; }}
      .save-status.saved {{ color: #4a4; }}
      .audio-note {{ font-size: 0.75em; color: #666; margin-top: 0.2em; }}
      .verdict-tag {{ display: inline-block; padding: 1px 7px; border-radius: 10px; font-size: 0.75em; vertical-align: middle; margin-left: 0.4em; }}
      .v-fine   {{ background: #4d9; color: white; }}
      .v-broken {{ background: #d44; color: white; }}
      .v-unsure {{ background: #ea0; color: white; }}
      .v-unset  {{ background: #bbb; color: white; }}
      legend {{ font-size: 0.85em; color: #666; margin-bottom: 0.5em; }}
    </style></head><body>
    <div class="sticky">
      <h1>AITW ep2 — verdict {len(problem_ids)} segs in <code>{focus_lang}</code></h1>
      <legend>★ = explicitly escalated in queue. Click a lang to jump.
      Overall: {verdicted_total}/{total_problem} verdicted
      ({overall['fine']} fine, {overall['broken']} broken, {overall['unsure']} unsure).</legend>
      <nav>{nav_html}</nav>
    </div>
    <h2 class="lang-header">{focus_lang} — {len(problem_ids)} segments needing verdict</h2>
    {''.join(rows) if rows else '<p>No problem segments here.</p>'}
    <script>
      // Auto-save debounce per key
      const saveTimers = {{}};

      function markDirty(key) {{
        const s = document.getElementById('status_' + key);
        if (s) {{ s.textContent = '● unsaved'; s.className = 'save-status dirty'; }}
        // Debounced auto-save (1.2s after last keystroke)
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
          }} else {{
            if (s) {{ s.textContent = '✗ save FAILED (HTTP ' + r.status + ')'; s.className = 'save-status dirty'; }}
          }}
        }} catch (e) {{
          if (s) {{ s.textContent = '✗ save FAILED: ' + e.message; s.className = 'save-status dirty'; }}
        }}
      }}

      async function verdict(key, v) {{
        // FLUSH any pending notes save FIRST, await it, then verdict
        await saveNotes(key);
        const r = await fetch('/verdict?key=' + encodeURIComponent(key) + '&v=' + v, {{method:'POST'}});
        await r.json();
        const el = document.getElementById(key);
        if (!el) return location.reload();
        el.className = 'row v-' + v;
        const tag = el.querySelector('.verdict-tag');
        tag.className = 'verdict-tag v-' + v;
        tag.textContent = v;
      }}

      // Flush all dirty notes on page-hide (nav-away safety net)
      window.addEventListener('beforeunload', () => {{
        for (const key in saveTimers) {{
          const ta = document.getElementById('notes_' + key);
          if (ta) {{
            const body = new URLSearchParams();
            body.append('key', key);
            body.append('notes', ta.value);
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
        if u.path in ("/", "/index.html"):
            q = parse_qs(u.query)
            focus = q.get("lang", [None])[0]
            verdicts = load_verdicts()
            body = render_page(verdicts, focus).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
            self.send_header("Pragma", "no-cache")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if u.path.startswith("/audio/"):
            # /audio/<lang>/<file>            -> PACK/audio/<lang>/<file>
            # /audio/<lang>/wav/<file>        -> PACK/audio/<lang>/wav/<file>
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
            if key and v in ("fine", "broken", "unsure", "unset"):
                verdicts = load_verdicts()
                entry = verdicts.get(key) or {}
                entry["verdict"] = v
                entry.setdefault("notes", "")
                verdicts[key] = entry
                save_verdicts(verdicts)
                body = json.dumps({"ok": True}).encode("utf-8")
                self.send_response(200); self.send_header("Content-Type","application/json"); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
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
                entry["notes"] = notes
                entry.setdefault("verdict", "unset")
                verdicts[key] = entry
                save_verdicts(verdicts)
                body = json.dumps({"ok": True}).encode("utf-8")
                self.send_response(200); self.send_header("Content-Type","application/json"); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
                return
        self.send_error(400)


if __name__ == "__main__":
    print(f"\n  AITW ep2 — 239-segment verdict tool")
    print(f"  ────────────────────────────────────")
    print(f"  Open (tailscale):")
    print(f"    http://spark-f62c:{PORT}")
    print(f"    http://spark-f62c.tail3c0d12.ts.net:{PORT}")
    print(f"    http://100.99.83.64:{PORT}")
    print(f"  Verdicts saved to: {VERDICT_FILE}")
    print(f"  Ctrl-C to stop.\n")
    HTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
