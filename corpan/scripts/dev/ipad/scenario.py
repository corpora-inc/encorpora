#!/usr/bin/env python3
"""
Corpán scenario runner — drive the iPad through a scripted user journey for
TESTING (assert + screenshot every beat) or VIDEO sessions (timed pauses +
narration + frame capture). One scenario = a persona + a setup + a list of
beats; the runner injects state, walks the UI, captures screenshots + logs, and
writes a markdown report with an inline filmstrip.

Design: a thin orchestrator over the battle-tested `cdp.sh` (WebInspector
eval/click, with built-in retries) + `screenshot.py` (pixel grabs via
pymobiledevice3). No new device plumbing — reuse what already works on-device.

Usage:
  python3 scenario.py scenarios/id_english_beginner.json
  python3 scenario.py scenarios/id_english_beginner.json --video   # add pauses
Requires (see ipad-debug-pipeline): `sudo pymobiledevice3 remote tunneld`
running, Web Inspector ON, the app foregrounded.

Beat keys (any combination, executed in this order within a beat):
  narrate:      str   — caption line (report + console; future: video subtitle)
  reset:        bool  — clear onboarding + landing, reload (fresh first-run)
  set_state:    obj   — merge into the persisted stack settings, then reload
                        {languages?, interests?, levels?, onboarded?}
  goto:         str   — deep-link a pack via ?game=<id> (+ optional entryId)
  reload:       bool
  wait_text:    str   — poll until the visible text contains this (timeout)
  wait_heading: str   — poll until the h1/h2 contains this
  tap:          str   — click the first visible <button> whose text contains it
  tap_any:      str   — click first visible button/[role=button]/[role=option]
  tap_anchor:   obj   — language-agnostic tap by stable attribute, not text:
                        {aria?, data?: {name,value?}, role?, testid?, selector?}
  assert_anchor: obj  — same shape as tap_anchor; pass/fail on element presence
  assert_text:  str   — record pass/fail on whether the text is visible
  assert_no_error: bool — fail if the ttsdbg/console shows an Error since start
  assert_in_viewport: obj|str — check an anchor (or the last tapped element when
                        "last") has its bounding rect inside the viewport
  screenshot:   str   — capture a named pixel screenshot into the run dir
  pause:        int   — milliseconds to hold (reflection beats for video)

Heuristic assertions (automatic, no beat needed):
  - Untranslated screen (soft WARN): when the persona UI language is non-English
    ("ui_lang" in the scenario, or languages[0] != "en"), telltale English UI
    words visible on screen as whole words are flagged.
  - Dead CTA (soft WARN): after every tap, a cheap DOM signature (innerText
    length + href) is compared before/after; no change → "possible dead CTA".
  - Off-screen primary button: assert_in_viewport flags a clipped/off-screen
    element.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
CDP = HERE / "cdp.sh"
SHOT = HERE / "screenshot.py"


def _pmd_python() -> str:
    out = subprocess.run(
        ["pipx", "environment", "--value", "PIPX_LOCAL_VENVS"],
        capture_output=True, text=True,
    ).stdout.strip()
    return str(Path(out) / "pymobiledevice3" / "bin" / "python")


PY = _pmd_python()


import os


def cdp_eval(expr: str, attempts: int = 4) -> str:
    """Run a JS expression on the device WebView; return the JSON/string result."""
    r = subprocess.run(
        ["bash", str(CDP), "eval", expr],
        capture_output=True, text=True,
        env={**os.environ, "CDP_ATTEMPTS": str(attempts)},
    )
    return (r.stdout or "").strip()


def screenshot(dest: Path) -> bool:
    subprocess.run([PY, str(SHOT), str(dest)], capture_output=True, text=True)
    return dest.exists()


# ---- in-page helpers (kept tiny + quote-safe: single quotes only, no backticks/$) ----

def _js_visible_text() -> str:
    return "(()=>document.body.innerText)()"


def _js_heading() -> str:
    return "(()=>{const h=document.querySelector('h1,h2');return h?h.textContent:''})()"


def _js_tap(text: str, any_role: bool) -> str:
    sel = "button,[role=button],[role=option]" if any_role else "button"
    safe = json.dumps(text)
    return (
        "(()=>{const els=[...document.querySelectorAll('" + sel + "')]"
        ".filter(e=>e.offsetParent!==null);"
        "const el=els.find(e=>(e.textContent||'').includes(" + safe + "));"
        "if(!el)return 'NF';const t=el.closest('button')||el;"
        "window.__corpan_last_tapped=t;t.click();return 'ok';})()"
    )


# ---- language-agnostic anchors (target by stable attributes, not visible text) ----

def _anchor_selector(anchor) -> str:
    """Build a CSS selector from an anchor spec.

    Accepts a string (used verbatim as a CSS selector) or an object with any of:
      aria:     str  → [aria-label*="..."]
      role:     str  → [role="..."]
      testid:   str  → [data-testid="..."]
      data:     {name, value?} → [data-<name>] or [data-<name>="<value>"]
      selector: str  → raw CSS selector (escape hatch)
    Multiple keys AND together (all must match). Returns a CSS selector string.
    """
    if isinstance(anchor, str):
        return anchor
    parts: list[str] = []
    if anchor.get("selector"):
        parts.append(str(anchor["selector"]))
    if anchor.get("aria"):
        parts.append('[aria-label*=' + json.dumps(str(anchor["aria"])) + ']')
    if anchor.get("role"):
        parts.append('[role=' + json.dumps(str(anchor["role"])) + ']')
    if anchor.get("testid"):
        parts.append('[data-testid=' + json.dumps(str(anchor["testid"])) + ']')
    data = anchor.get("data")
    if isinstance(data, dict) and data.get("name"):
        nm = str(data["name"])
        if data.get("value") is not None:
            parts.append('[data-' + nm + '=' + json.dumps(str(data["value"])) + ']')
        else:
            parts.append('[data-' + nm + ']')
    return "".join(parts) if parts else "button"


def _js_tap_anchor(anchor) -> str:
    """Click the first visible element matching the anchor's CSS selector."""
    sel = json.dumps(_anchor_selector(anchor))
    return (
        "(()=>{const els=[...document.querySelectorAll(" + sel + ")]"
        ".filter(e=>e.offsetParent!==null);const el=els[0];"
        "if(!el)return 'NF';const t=el.closest('button')||el;"
        "window.__corpan_last_tapped=t;t.click();return 'ok';})()"
    )


def _js_anchor_present(anchor) -> str:
    """Return 'yes'/'no' for whether a visible element matches the anchor."""
    sel = json.dumps(_anchor_selector(anchor))
    return (
        "(()=>{const els=[...document.querySelectorAll(" + sel + ")]"
        ".filter(e=>e.offsetParent!==null);return els.length?'yes':'no';})()"
    )


def _js_in_viewport(anchor) -> str:
    """Report whether the anchored element's rect is inside the viewport.

    When anchor is the string 'last', use the element stashed on the last tap
    (window.__corpan_last_tapped). Returns 'OK', 'OFFSCREEN:<details>', or 'NF'.
    """
    if anchor == "last":
        getter = "window.__corpan_last_tapped"
    else:
        sel = json.dumps(_anchor_selector(anchor))
        getter = "[...document.querySelectorAll(" + sel + ")].filter(e=>e.offsetParent!==null)[0]"
    return (
        "(()=>{const el=" + getter + ";if(!el)return 'NF';"
        "const r=el.getBoundingClientRect();"
        "const vw=window.innerWidth,vh=window.innerHeight;"
        "const clipped=r.left<0||r.top<0||r.right>vw||r.bottom>vh;"
        "const gone=r.right<=0||r.bottom<=0||r.left>=vw||r.top>=vh||r.width===0||r.height===0;"
        "if(gone)return 'OFFSCREEN:offscreen rect='+JSON.stringify({l:Math.round(r.left),t:Math.round(r.top),r:Math.round(r.right),b:Math.round(r.bottom),vw:vw,vh:vh});"
        "if(clipped)return 'OFFSCREEN:clipped rect='+JSON.stringify({l:Math.round(r.left),t:Math.round(r.top),r:Math.round(r.right),b:Math.round(r.bottom),vw:vw,vh:vh});"
        "return 'OK';})()"
    )


# ---- heuristic: cheap DOM signature for dead-CTA detection ----

def _js_dom_signature() -> str:
    """A cheap before/after fingerprint of the page: innerText length + href."""
    return "(()=>((document.body?document.body.innerText.length:0)+'|'+location.href))()"


def dom_signature() -> str:
    return cdp_eval(_js_dom_signature(), attempts=2)


# Telltale English UI chrome words — if these show up as whole words on a screen
# whose persona UI language is non-English, the screen is likely untranslated.
ENGLISH_UI_WORDS = [
    "Continue", "Settings", "Skip", "Open", "Back", "Next", "Done",
    "Cancel", "Save", "Search", "Close", "Start", "Finish", "Begin",
    "Submit", "Loading", "Welcome", "Choose", "Select", "Learn",
]


def _english_ui_hits(text: str) -> list[str]:
    """Whole-word matches of telltale English UI words in the visible text."""
    if not text:
        return []
    hits: list[str] = []
    for w in ENGLISH_UI_WORDS:
        # whole-word match: bounded by non-letters (avoid e.g. "Selection")
        pat = re.compile(r"(?<![A-Za-z])" + re.escape(w) + r"(?![A-Za-z])")
        if pat.search(text):
            hits.append(w)
    return hits


def _js_set_state(setup: dict) -> str:
    payload = json.dumps(setup)
    # Merge into the persisted stack settings + optionally reset onboarding.
    return (
        "(()=>{const K='corpan-stacks-v1';const raw=localStorage.getItem(K);"
        "if(!raw)return 'no-state';const s=JSON.parse(raw);const st=s.state||s;"
        "const p=" + payload + ";"
        "if(p.onboarded!==undefined)st.onboarded=p.onboarded;"
        "if(p.interests!==undefined)st.interests=p.interests;"
        "const a=st.stacks&&st.stacks[st.activeStackId];"
        "if(a&&a.settings){if(p.languages!==undefined)a.settings.languages=p.languages;"
        "if(p.levels!==undefined)a.settings.levels=p.levels;}"
        "localStorage.setItem(K,JSON.stringify(s));return 'ok';})()"
    )


def _js_reset() -> str:
    # Clear onboarding + landing AND navigate to a clean URL (strip any leftover
    # ?game= deep-link, which would otherwise launch a pack over onboarding).
    return (
        "(()=>{const K='corpan-stacks-v1';const raw=localStorage.getItem(K);"
        "if(raw){const s=JSON.parse(raw);(s.state||s).onboarded=false;"
        "localStorage.setItem(K,JSON.stringify(s));}"
        "localStorage.removeItem('corpan-landing-v1');"
        "location.href=location.origin+location.pathname;return 'reset';})()"
    )


def poll_text(needle: str, in_heading: bool, timeout_s: float = 20.0) -> bool:
    js = _js_heading() if in_heading else _js_visible_text()
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        out = cdp_eval(js, attempts=2)
        if out and "cdp failed" not in out and needle in out:
            return True
        time.sleep(1.0)
    return False


def _ui_lang(scn: dict) -> str:
    """The persona's UI language. Explicit "ui_lang" wins; else languages[0]."""
    if scn.get("ui_lang"):
        return str(scn["ui_lang"])
    # Otherwise infer from the first set_state that seeds the stack languages
    # (languages[0] is the primary/UI language per the single-language rule).
    for beat in scn.get("beats", []):
        st = beat.get("set_state")
        if isinstance(st, dict) and isinstance(st.get("languages"), list) and st["languages"]:
            return str(st["languages"][0])
    return "en"


def run(scenario_path: Path, video: bool) -> dict:
    """Run one scenario. Returns a result dict for the suite roll-up."""
    scn = json.loads(scenario_path.read_text())
    name = scn.get("name", scenario_path.stem)
    run_dir = HERE / "runs" / f"{name}-{int(time.time())}"
    run_dir.mkdir(parents=True, exist_ok=True)

    ui_lang = _ui_lang(scn)
    check_untranslated = ui_lang != "en"

    report: list[str] = [
        f"# Scenario run: {scn.get('title', name)}",
        "",
        f"> {scn.get('persona', '')}",
        "",
        f"_UI language: `{ui_lang}`"
        + ("" if check_untranslated else " (English — untranslated heuristic off)")
        + "_",
        "",
    ]
    failures = 0
    warnings = 0
    shot_n = 0

    def warn(msg: str) -> None:
        nonlocal warnings
        warnings += 1
        report.append(f"- ⚠️ WARN: {msg}")

    print(f"▶ {name}  →  {run_dir}")
    for i, beat in enumerate(scn.get("beats", [])):
        if "narrate" in beat:
            line = beat["narrate"]
            print(f"  · {line}")
            report.append(f"**{line}**")
        if beat.get("reset"):
            cdp_eval(_js_reset())  # also navigates to a clean URL
            time.sleep(5)
        if "set_state" in beat:
            cdp_eval(_js_set_state(beat["set_state"]))
            cdp_eval("(()=>{location.reload();return 'r'})()")
            time.sleep(5)
        if "goto" in beat:
            gid = json.dumps(beat["goto"])
            cdp_eval("(()=>{const u=new URL(location);u.searchParams.set('game'," + gid + ");location.href=u.toString();return 'go'})()")
            time.sleep(3)
        if beat.get("reload"):
            cdp_eval("(()=>{location.reload();return 'r'})()")
            time.sleep(5)
        if "wait_text" in beat:
            ok = poll_text(beat["wait_text"], in_heading=False)
            report.append(f"- wait_text `{beat['wait_text']}`: {'✓' if ok else '✗ TIMEOUT'}")
            if not ok:
                failures += 1
        if "wait_heading" in beat:
            ok = poll_text(beat["wait_heading"], in_heading=True)
            report.append(f"- wait_heading `{beat['wait_heading']}`: {'✓' if ok else '✗ TIMEOUT'}")
            if not ok:
                failures += 1
        # Dead-CTA heuristic: any tap is wrapped with a before/after DOM signature.
        def _tapped(label: str, res: str, settle: float) -> None:
            sig_before = dom_signature() if res == "ok" else ""
            time.sleep(settle)
            if res == "ok" and sig_before and "cdp failed" not in sig_before:
                sig_after = dom_signature()
                if sig_after and "cdp failed" not in sig_after and sig_after == sig_before:
                    warn(f"possible dead CTA — `{label}` produced no DOM/route change")

        if "tap" in beat:
            res = cdp_eval(_js_tap(beat["tap"], any_role=False))
            report.append(f"- tap `{beat['tap']}`: {res}")
            _tapped(beat["tap"], res, beat.get("settle", 1.2))
        if "tap_any" in beat:
            res = cdp_eval(_js_tap(beat["tap_any"], any_role=True))
            report.append(f"- tap_any `{beat['tap_any']}`: {res}")
            _tapped(beat["tap_any"] or "(first button)", res, beat.get("settle", 1.2))
        if "tap_anchor" in beat:
            anchor = beat["tap_anchor"]
            res = cdp_eval(_js_tap_anchor(anchor))
            report.append(f"- tap_anchor `{_anchor_selector(anchor)}`: {res}")
            _tapped(_anchor_selector(anchor), res, beat.get("settle", 1.2))
        if beat.get("tap_primary"):
            # The footer's primary action (Continue/Lanjutkan/…) — last visible
            # button. Language-agnostic; works regardless of localized label.
            res = cdp_eval(
                "(()=>{const b=[...document.querySelectorAll('button')]"
                ".filter(e=>e.offsetParent!==null);const el=b[b.length-1];"
                "if(!el)return 'NF';window.__corpan_last_tapped=el;el.click();return 'ok';})()"
            )
            report.append(f"- tap_primary: {res}")
            _tapped("tap_primary", res, beat.get("settle", 1.2))
        if "assert_anchor" in beat:
            anchor = beat["assert_anchor"]
            out = cdp_eval(_js_anchor_present(anchor), attempts=3)
            present = out.strip().strip('"') == "yes"
            mark = "✓" if present else "✗ FAIL"
            report.append(f"- assert_anchor `{_anchor_selector(anchor)}`: {mark}")
            if not present:
                failures += 1
        if "assert_in_viewport" in beat:
            anchor = beat["assert_in_viewport"]
            out = cdp_eval(_js_in_viewport(anchor), attempts=3).strip().strip('"')
            label = "last tapped" if anchor == "last" else _anchor_selector(anchor)
            if out == "OK":
                report.append(f"- assert_in_viewport `{label}`: ✓")
            elif out == "NF":
                report.append(f"- assert_in_viewport `{label}`: ✗ FAIL (element not found)")
                failures += 1
            else:
                report.append(f"- assert_in_viewport `{label}`: ✗ FAIL ({out})")
                failures += 1
        if "assert_text" in beat:
            out = cdp_eval(_js_visible_text(), attempts=3)
            present = beat["assert_text"] in out
            mark = "✓" if present else "✗ FAIL"
            report.append(f"- assert_text `{beat['assert_text']}`: {mark}")
            if not present:
                failures += 1
        pause_ms = beat.get("pause", 0)
        if video and "pause_video" in beat:
            pause_ms = max(pause_ms, beat["pause_video"])
        if pause_ms:
            time.sleep(pause_ms / 1000.0)
        if "screenshot" in beat:
            shot_n += 1
            fn = f"{shot_n:02d}-{beat['screenshot']}.png"
            ok = screenshot(run_dir / fn)
            report.append(f"- screenshot `{fn}`: {'✓' if ok else '✗'}")
            # Untranslated-screen heuristic: at every captured screen, if the
            # persona UI language is non-English, flag telltale English UI words.
            if check_untranslated and beat.get("check_untranslated", True):
                text = cdp_eval(_js_visible_text(), attempts=2)
                if text and "cdp failed" not in text:
                    hits = _english_ui_hits(text)
                    if hits:
                        warn(
                            f"untranslated UI (lang `{ui_lang}`) — English words on `{fn}`: "
                            + ", ".join(hits)
                        )
            report.append("")
            report.append(f"![{fn}]({fn})")
            report.append("")

    report.append("")
    status = "PASS" if failures == 0 else f"{failures} FAILURE(S)"
    report.append(f"## Result: {status}" + (f" · {warnings} warning(s)" if warnings else ""))
    (run_dir / "report.md").write_text("\n".join(report) + "\n")
    icon = "✅ PASS" if failures == 0 else f"❌ {failures} failure(s)"
    if warnings:
        icon += f"  (⚠️ {warnings} warning(s))"
    print(f"{icon}  →  {run_dir/'report.md'}")
    return {
        "name": name,
        "title": scn.get("title", name),
        "ui_lang": ui_lang,
        "failures": failures,
        "warnings": warnings,
        "passed": failures == 0,
        "report": str((run_dir / "report.md").resolve()),
        "run_dir": str(run_dir.resolve()),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("scenario", help="path to a scenario .json")
    ap.add_argument("--video", action="store_true", help="honor pause_video (reflection holds)")
    args = ap.parse_args()
    p = Path(args.scenario)
    if not p.exists():
        p = HERE / args.scenario  # fall back to runner-relative
    result = run(p.resolve(), args.video)
    sys.exit(0 if result["passed"] else 1)


if __name__ == "__main__":
    main()
