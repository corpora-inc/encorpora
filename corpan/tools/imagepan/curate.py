#!/usr/bin/env python3
"""Local, zero-dependency human curation web app for the imagepan pack.

The GPU box produces, per concept, four candidate PNGs named
``<key>_0.png`` .. ``<key>_3.png`` (plus a ``<key>_<n>.json`` reproducibility
sidecar we ignore here) into a candidates directory. This tool lets a human
walk the concept list one at a time, view the four candidates in a 4-up grid,
and record a verdict (pick one / reject all / request a regen with a note).

Stdlib only — ``http.server`` + ``json`` + ``argparse`` + ``pathlib`` — so it
runs on a bare Python with no venv. Bind is 0.0.0.0 so it is reachable both
locally and over Tailscale from the GPU box.

Verdicts are streamed to ``verdicts.json`` after every action (atomic write),
so a crash or restart never loses work; on restart the existing file is loaded
and the UI resumes where it left off.

Verdict record format (exactly):

    { "<concept_key>": {"verdict": "pick"|"reject"|"regen",
                        "candidate": <int 0-3, ONLY when verdict=="pick">,
                        "note": "<string, may be empty>"} }
"""

from __future__ import annotations

import argparse
import json
import os
import re
import socket
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

# Number of candidate images produced per concept on the GPU box.
CANDIDATES_PER_CONCEPT = 4

# Only <key>_<n>.png filenames are ever served (path-traversal guard). The key
# itself is validated against the concept list, and <n> is 0..3.
_IMG_NAME_RE = re.compile(r"^[A-Za-z0-9_-]+_[0-3]\.png$")


# --------------------------------------------------------------------------- #
# Shared state (concepts + candidates + verdicts) held on the handler class.   #
# --------------------------------------------------------------------------- #
class State:
    """Everything the request handlers need, loaded once at startup."""

    def __init__(self, candidates_dir: Path, concepts_path: Path,
                 verdicts_path: Path) -> None:
        self.candidates_dir = candidates_dir
        self.concepts_path = concepts_path
        self.verdicts_path = verdicts_path
        self.concepts: list[dict] = self._load_concepts()
        self.verdicts: dict = self._load_verdicts()
        # Map key -> list of available candidate indices (0..3) present on disk.
        self.available: dict[str, list[int]] = self._scan_candidates()

    def _load_concepts(self) -> list[dict]:
        try:
            raw = json.loads(self.concepts_path.read_text(encoding="utf-8"))
        except FileNotFoundError:
            print(f"[curate] concepts file not found: {self.concepts_path}")
            return []
        except json.JSONDecodeError as exc:
            print(f"[curate] concepts file is not valid JSON: {exc}")
            return []
        return [c for c in raw if isinstance(c, dict) and c.get("key")]

    def _load_verdicts(self) -> dict:
        try:
            raw = json.loads(self.verdicts_path.read_text(encoding="utf-8"))
        except FileNotFoundError:
            return {}
        except json.JSONDecodeError:
            print(f"[curate] warning: {self.verdicts_path} was unreadable; "
                  "starting fresh (old file will be overwritten on next save)")
            return {}
        return raw if isinstance(raw, dict) else {}

    def _scan_candidates(self) -> dict[str, list[int]]:
        """For every concept, find which of its <key>_<n>.png files exist."""
        available: dict[str, list[int]] = {}
        if not self.candidates_dir.is_dir():
            return available
        for concept in self.concepts:
            key = concept["key"]
            present = []
            for n in range(CANDIDATES_PER_CONCEPT):
                if (self.candidates_dir / f"{key}_{n}.png").is_file():
                    present.append(n)
            available[key] = present
        return available

    def save_verdicts(self) -> None:
        """Atomically persist verdicts (write tmp then os.replace)."""
        self.verdicts_path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.verdicts_path.with_suffix(
            self.verdicts_path.suffix + ".tmp")
        tmp.write_text(
            json.dumps(self.verdicts, indent=2, ensure_ascii=False,
                       sort_keys=True) + "\n",
            encoding="utf-8",
        )
        os.replace(tmp, self.verdicts_path)


# --------------------------------------------------------------------------- #
# HTML — a single self-contained page; concept data is embedded as JSON.       #
# --------------------------------------------------------------------------- #
def render_page(state: State) -> bytes:
    payload = {
        "concepts": [
            {
                "key": c["key"],
                "word": c.get("word", c["key"]),
                "sense_subject": c.get("sense_subject", ""),
                "sense_gloss": c.get("sense_gloss", ""),
                "domain": c.get("domain", ""),
                "cefr": c.get("cefr", ""),
                "available": state.available.get(c["key"], []),
            }
            for c in state.concepts
        ],
        "verdicts": state.verdicts,
        "candidatesDirMissing": not state.candidates_dir.is_dir(),
        "candidatesDir": str(state.candidates_dir),
    }
    data_json = json.dumps(payload, ensure_ascii=False)
    html = _PAGE_TEMPLATE.replace("/*__DATA__*/", data_json)
    return html.encode("utf-8")


_PAGE_TEMPLATE = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>imagepan curation</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; font: 15px/1.4 system-ui, -apple-system, sans-serif;
    background: #14161a; color: #e8eaed;
  }
  header {
    display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap;
    padding: 12px 20px; background: #1d2026; border-bottom: 1px solid #2c3038;
    position: sticky; top: 0; z-index: 10;
  }
  header h1 { font-size: 16px; margin: 0; font-weight: 600; }
  .progress { color: #9aa0a6; font-variant-numeric: tabular-nums; }
  .bar { flex: 1 1 200px; height: 6px; background: #2c3038; border-radius: 3px;
         overflow: hidden; min-width: 120px; }
  .bar > i { display: block; height: 100%; background: #4c8bf5; width: 0; }
  main { max-width: 1000px; margin: 0 auto; padding: 20px; }
  .caption { font-size: 22px; font-weight: 600; margin: 0 0 4px; }
  .meta { color: #9aa0a6; margin: 0 0 16px; }
  .meta b { color: #c8ccd2; font-weight: 600; }
  .pill { display: inline-block; padding: 1px 8px; border-radius: 999px;
          background: #2c3038; font-size: 12px; margin-left: 6px; }
  .verdict-tag { font-weight: 600; }
  .verdict-pick { color: #7bd88f; }
  .verdict-reject { color: #f28b82; }
  .verdict-regen { color: #fdd663; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (max-width: 560px) { .grid { grid-template-columns: 1fr; } }
  .cell {
    position: relative; border: 2px solid #2c3038; border-radius: 8px;
    overflow: hidden; background: #0c0d10; aspect-ratio: 1 / 1;
    display: flex; align-items: center; justify-content: center; cursor: pointer;
  }
  .cell.chosen { border-color: #7bd88f; }
  .cell img { max-width: 100%; max-height: 100%; display: block; }
  .cell .num {
    position: absolute; top: 6px; left: 6px; width: 24px; height: 24px;
    background: rgba(0,0,0,.6); border-radius: 6px; display: flex;
    align-items: center; justify-content: center; font-weight: 700;
    font-size: 13px;
  }
  .cell .missing { color: #f28b82; font-size: 13px; padding: 20px;
                   text-align: center; }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; margin: 18px 0 10px; }
  button {
    font: inherit; padding: 8px 14px; border-radius: 8px; cursor: pointer;
    border: 1px solid #3a3f48; background: #262a31; color: #e8eaed;
  }
  button:hover { background: #2f343c; }
  button.danger { border-color: #5a2b2b; }
  button.warn { border-color: #5a4d1f; }
  kbd {
    font: 11px/1 ui-monospace, monospace; background: #14161a;
    border: 1px solid #3a3f48; border-bottom-width: 2px; border-radius: 4px;
    padding: 2px 5px; margin-left: 5px;
  }
  .note-row { margin: 12px 0; }
  textarea {
    width: 100%; min-height: 60px; font: inherit; padding: 8px;
    border-radius: 8px; border: 1px solid #3a3f48; background: #14161a;
    color: #e8eaed; resize: vertical;
  }
  .nav { display: flex; justify-content: space-between; align-items: center;
         margin-top: 8px; }
  .banner {
    background: #3a2626; border: 1px solid #5a2b2b; color: #f6c7c3;
    padding: 14px 18px; border-radius: 8px; margin-bottom: 16px;
  }
  .hint { color: #9aa0a6; font-size: 13px; }
  code { background: #14161a; padding: 1px 5px; border-radius: 4px; }
</style>
</head>
<body>
<header>
  <h1>imagepan curation</h1>
  <div class="progress" id="progress">0 / 0 judged</div>
  <div class="bar"><i id="barfill"></i></div>
  <div class="progress" id="position"></div>
</header>
<main id="main"></main>

<script>
const DATA = /*__DATA__*/;
const concepts = DATA.concepts;
let verdicts = DATA.verdicts || {};
let idx = 0;

// Jump to the first concept without a verdict (resume where we left off).
(function resume() {
  const firstUnjudged = concepts.findIndex(c => !verdicts[c.key]);
  idx = firstUnjudged === -1 ? 0 : firstUnjudged;
})();

function judgedCount() {
  return concepts.filter(c => verdicts[c.key]).length;
}

function updateHeader() {
  const done = judgedCount(), total = concepts.length;
  document.getElementById('progress').textContent = `${done} / ${total} judged`;
  document.getElementById('barfill').style.width =
    total ? `${(done / total) * 100}%` : '0';
  document.getElementById('position').textContent =
    total ? `#${idx + 1} of ${total}` : '';
}

function verdictLabel(v) {
  if (!v) return '';
  if (v.verdict === 'pick') return `picked #${v.candidate + 1}`;
  return v.verdict;
}

function render() {
  const main = document.getElementById('main');
  if (DATA.candidatesDirMissing) {
    main.innerHTML =
      `<div class="banner"><b>Candidates directory not found.</b><br>` +
      `Expected at <code>${DATA.candidatesDir}</code>.<br>` +
      `Point <code>--candidates</code> at the directory of ` +
      `<code>&lt;key&gt;_&lt;n&gt;.png</code> files, then reload.</div>`;
    updateHeader();
    return;
  }
  if (!concepts.length) {
    main.innerHTML = `<div class="banner">No concepts loaded.</div>`;
    return;
  }
  const c = concepts[idx];
  const v = verdicts[c.key];
  const cells = [];
  for (let n = 0; n < 4; n++) {
    const has = c.available.includes(n);
    const chosen = v && v.verdict === 'pick' && v.candidate === n;
    if (has) {
      cells.push(
        `<div class="cell${chosen ? ' chosen' : ''}" data-pick="${n}" ` +
        `title="Pick candidate ${n + 1}">` +
        `<span class="num">${n + 1}</span>` +
        `<img src="/img/${encodeURIComponent(c.key)}_${n}.png" alt="">` +
        `</div>`);
    } else {
      cells.push(
        `<div class="cell"><span class="num">${n + 1}</span>` +
        `<span class="missing">no candidate<br>${c.key}_${n}.png</span></div>`);
    }
  }
  const tagClass = v ? `verdict-${v.verdict}` : '';
  main.innerHTML = `
    <div class="caption">${escapeHtml(c.sense_subject || c.word)}</div>
    <div class="meta">
      <b>${escapeHtml(c.word)}</b>
      ${c.sense_gloss ? '· ' + escapeHtml(c.sense_gloss) : ''}
      <span class="pill">${escapeHtml(c.domain)}</span>
      <span class="pill">${escapeHtml(c.cefr)}</span>
      ${v ? `· <span class="verdict-tag ${tagClass}">` +
            `${verdictLabel(v)}</span>` : ''}
    </div>
    <div class="grid">${cells.join('')}</div>
    <div class="actions">
      <button data-pick="0">Pick 1 <kbd>1</kbd></button>
      <button data-pick="1">Pick 2 <kbd>2</kbd></button>
      <button data-pick="2">Pick 3 <kbd>3</kbd></button>
      <button data-pick="3">Pick 4 <kbd>4</kbd></button>
      <button class="danger" data-reject>Reject all <kbd>r</kbd></button>
      <button class="warn" data-regen>Request regen <kbd>n</kbd></button>
    </div>
    <div class="note-row">
      <textarea id="note" placeholder="Optional note (e.g. regen reason, ` +
        `composition hint)">${escapeHtml(v && v.note ? v.note : '')}</textarea>
    </div>
    <div class="nav">
      <button data-prev>&larr; Prev <kbd>&larr;</kbd></button>
      <span class="hint">Keys 1-4 pick · r reject · n regen ·
        &larr;/&rarr; move</span>
      <button data-next>Next &rarr; <kbd>&rarr;</kbd></button>
    </div>`;

  main.querySelectorAll('[data-pick]').forEach(el => {
    const n = parseInt(el.getAttribute('data-pick'), 10);
    if (el.classList.contains('cell')) {
      el.addEventListener('click', () => pick(n));
    } else {
      el.addEventListener('click', () => pick(n));
    }
  });
  main.querySelector('[data-reject]').addEventListener('click', reject);
  main.querySelector('[data-regen]').addEventListener('click', regen);
  main.querySelector('[data-prev]').addEventListener('click', () => move(-1));
  main.querySelector('[data-next]').addEventListener('click', () => move(1));
  updateHeader();
}

function currentNote() {
  const el = document.getElementById('note');
  return el ? el.value : '';
}

async function saveVerdict(record) {
  const c = concepts[idx];
  verdicts[c.key] = record;
  updateHeader();
  try {
    await fetch('/verdict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: c.key, record }),
    });
  } catch (e) {
    console.error('failed to save verdict', e);
    alert('Failed to save verdict to server: ' + e);
  }
}

function pick(n) {
  const c = concepts[idx];
  if (!c.available.includes(n)) return;   // ignore picks of missing candidates
  saveVerdict({ verdict: 'pick', candidate: n, note: currentNote() })
    .then(() => { render(); autoAdvance(); });
}

function reject() {
  saveVerdict({ verdict: 'reject', note: currentNote() })
    .then(() => { render(); autoAdvance(); });
}

function regen() {
  const el = document.getElementById('note');
  if (el) el.focus();
  saveVerdict({ verdict: 'regen', note: currentNote() }).then(render);
}

function autoAdvance() {
  // Small delay so the chosen highlight is visible before moving on.
  if (idx < concepts.length - 1) setTimeout(() => move(1), 180);
}

function move(delta) {
  const next = idx + delta;
  if (next < 0 || next >= concepts.length) return;
  idx = next;
  render();
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

document.addEventListener('keydown', (e) => {
  if (e.target && e.target.tagName === 'TEXTAREA') {
    // In the note box: Escape blurs so shortcuts work again; else pass through.
    if (e.key === 'Escape') e.target.blur();
    return;
  }
  switch (e.key) {
    case '1': case '2': case '3': case '4':
      pick(parseInt(e.key, 10) - 1); break;
    case 'r': case 'R': reject(); break;
    case 'n': case 'N': e.preventDefault(); regen(); break;
    case 'ArrowLeft': move(-1); break;
    case 'ArrowRight': move(1); break;
  }
});

render();
</script>
</body>
</html>
"""


# --------------------------------------------------------------------------- #
# HTTP handler                                                                 #
# --------------------------------------------------------------------------- #
class Handler(BaseHTTPRequestHandler):
    state: State = None  # set on the class before serving

    # Quieter logs: one line per request is plenty.
    def log_message(self, fmt, *args):  # noqa: A003
        print(f"[curate] {self.address_string()} {fmt % args}")

    def _send(self, code: int, body: bytes, content_type: str) -> None:
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def do_GET(self):  # noqa: N802
        path = urlparse(self.path).path
        if path in ("/", "/index.html"):
            self._send(200, render_page(self.state), "text/html; charset=utf-8")
            return
        if path.startswith("/img/"):
            self._serve_image(path[len("/img/"):])
            return
        self._send(404, b"not found", "text/plain; charset=utf-8")

    def _serve_image(self, name: str) -> None:
        # Path-traversal guard: only bare <key>_<n>.png names that exist
        # directly in the candidates dir are ever served.
        if not _IMG_NAME_RE.match(name):
            self._send(404, b"bad image name", "text/plain; charset=utf-8")
            return
        target = (self.state.candidates_dir / name)
        # Resolve and confirm the parent is exactly the candidates dir.
        try:
            resolved = target.resolve()
            base = self.state.candidates_dir.resolve()
        except OSError:
            self._send(404, b"not found", "text/plain; charset=utf-8")
            return
        if resolved.parent != base or not resolved.is_file():
            self._send(404, b"not found", "text/plain; charset=utf-8")
            return
        try:
            body = resolved.read_bytes()
        except OSError:
            self._send(404, b"not found", "text/plain; charset=utf-8")
            return
        self._send(200, body, "image/png")

    def do_POST(self):  # noqa: N802
        path = urlparse(self.path).path
        if path != "/verdict":
            self._send(404, b"not found", "text/plain; charset=utf-8")
            return
        length = int(self.headers.get("Content-Length", 0) or 0)
        raw = self.rfile.read(length) if length else b""
        try:
            msg = json.loads(raw.decode("utf-8"))
            key = msg["key"]
            record = msg["record"]
        except (ValueError, KeyError, UnicodeDecodeError):
            self._send(400, b'{"ok":false,"error":"bad request"}',
                       "application/json")
            return

        clean = self._sanitize(key, record)
        if clean is None:
            self._send(400, b'{"ok":false,"error":"invalid verdict"}',
                       "application/json")
            return

        self.state.verdicts[key] = clean
        self.state.save_verdicts()
        self._send(200, b'{"ok":true}', "application/json")

    def _sanitize(self, key, record):
        """Coerce an incoming verdict to the exact stored shape, or None."""
        valid_keys = {c["key"] for c in self.state.concepts}
        if key not in valid_keys or not isinstance(record, dict):
            return None
        verdict = record.get("verdict")
        if verdict not in ("pick", "reject", "regen"):
            return None
        note = record.get("note", "")
        if not isinstance(note, str):
            note = ""
        out = {"verdict": verdict}
        if verdict == "pick":
            cand = record.get("candidate")
            if not isinstance(cand, int) or cand < 0 or cand > 3:
                return None
            out["candidate"] = cand
        out["note"] = note
        return out


def _lan_ip() -> str:
    """Best-effort primary LAN/Tailscale IP for the startup hint."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return socket.gethostname()


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--candidates", type=Path, default=Path("./candidates_a0a1"),
                    help="Directory of <key>_<n>.png candidate images.")
    ap.add_argument("--concepts", type=Path, default=Path("concepts_a0a1.json"),
                    help="Concept list JSON.")
    ap.add_argument("--verdicts", type=Path, default=Path("verdicts.json"),
                    help="Where to read/write verdicts.")
    ap.add_argument("--port", type=int, default=8765)
    args = ap.parse_args()

    state = State(args.candidates.resolve(), args.concepts.resolve(),
                  args.verdicts.resolve())
    Handler.state = state

    if not state.candidates_dir.is_dir():
        print(f"[curate] NOTE: candidates dir does not exist yet: "
              f"{state.candidates_dir}")
        print("[curate] The page will show a clear message until it appears.")
    print(f"[curate] concepts: {len(state.concepts)} · "
          f"resuming with {len(state.verdicts)} existing verdict(s)")

    server = ThreadingHTTPServer(("0.0.0.0", args.port), Handler)
    ip = _lan_ip()
    print("[curate] serving. Open one of:")
    print(f"[curate]   local:      http://localhost:{args.port}/")
    print(f"[curate]   remote/LAN: http://{ip}:{args.port}/  "
          "(e.g. over Tailscale)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[curate] shutting down")
        server.shutdown()


if __name__ == "__main__":
    main()
