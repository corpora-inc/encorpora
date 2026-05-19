#!/usr/bin/env python3
"""
Drive the Corpán Tauri WebView on a connected iOS device via Apple's
WebInspector protocol — the same pipe Safari uses for "Develop > <Device>".

Uses pymobiledevice3 as a library. We bypass its `webinspector cdp` CLI
because that subcommand calls uvicorn.run() from inside its own asyncio
loop and crashes on Python 3.13/3.14 (`RuntimeError: asyncio.run() cannot
be called from a running event loop`).

Subcommands
-----------
  eval EXPR            Run JS, print JSON result.
  scroll SELECTOR DY [--smooth]
                       Scroll the matched element by DY pixels.
                       SELECTOR can be "window" for the document scroller.
  click SELECTOR       Synthesize a click via the element's .click().
  dom SELECTOR         Print outerHTML + bounding rect for the element.
  rect SELECTOR        Print bounding rect (x, y, width, height) only.
  pages                List inspectable pages.

Requires
--------
  - sudo pymobiledevice3 remote tunneld   (already running)
  - Settings -> Apps -> Safari -> Advanced -> Web Inspector ON (iPad)
  - The Corpán app running on the iPad with an inspectable WebView.

Run via the pipx venv python:
  $(pipx environment --value PIPX_LOCAL_VENVS)/pymobiledevice3/bin/python \
      scripts/dev/ipad/ipad_cdp.py eval "document.title"
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from typing import Any, Optional

import uuid

from pymobiledevice3.cli.cli_common import _tunneld  # type: ignore
from pymobiledevice3.services.web_protocol.inspector_session import (  # type: ignore
    InspectorSession,
)
from pymobiledevice3.services.web_protocol.session_protocol import (  # type: ignore
    SessionProtocol,
)
from pymobiledevice3.services.webinspector import (  # type: ignore
    ApplicationPage,
    WebinspectorService,
)


CORPAN_BUNDLE = "com.corpora.corpan"
DEFAULT_TIMEOUT = 5.0


async def pick_corpan_page(inspector: WebinspectorService) -> ApplicationPage:
    pages = await inspector.get_open_application_pages(timeout=DEFAULT_TIMEOUT)
    matches = [
        p for p in pages
        if p.application.bundle == CORPAN_BUNDLE
        or "corpora.corpan" in (p.application.bundle or "")
    ]
    if not matches:
        # Fall back: any non-Safari WebView
        matches = [p for p in pages if "safari" not in (p.application.bundle or "").lower()]
    if not matches:
        raise SystemExit(
            "no inspectable pages found. unlock the iPad, confirm the app is "
            "running, and that Web Inspector is enabled."
        )
    return matches[0]


def _trace(msg: str) -> None:
    if os.environ.get("IPAD_CDP_TRACE"):
        print(f"[trace {asyncio.get_event_loop().time():.2f}] {msg}", file=sys.stderr, flush=True)


async def eval_js(expr: str, return_by_value: bool = True) -> Any:
    udid = os.environ.get("CORPAN_IPAD_UDID", "")
    _trace("tunneld start")
    rsd = await _tunneld(udid)
    _trace("tunneld done")
    if rsd is None:
        raise SystemExit("no tunneld-connected device. is `sudo pymobiledevice3 remote tunneld` running?")

    inspector = WebinspectorService(lockdown=rsd)
    _trace("inspector.connect")
    await inspector.connect(DEFAULT_TIMEOUT)
    _trace("connected")
    try:
        _trace("pick page")
        page = await pick_corpan_page(inspector)
        _trace(f"picked {page.application.bundle}")
        # Bypass WebinspectorService.inspector_session() because it calls
        # InspectorSession.create(wait_target=True) for WEB_PAGE targets, which
        # spin-waits for a `Target.targetCreated` event that this Tauri WKWebView
        # (iOS 26.4) never sends. We build the session with wait_target=False —
        # send_command then routes directly via protocol.send_receive (no target
        # wrapping), which is what we want for a single-window WebView anyway.
        _trace("inspector_session")
        session_id = str(uuid.uuid4()).upper()
        protocol = SessionProtocol(
            inspector, session_id, page.application, page.page, method_prefix=""
        )
        session = await InspectorSession.create(protocol, wait_target=False)
        _trace("session ready")
        _trace("console_enable")
        await session.console_enable()
        _trace("runtime_enable")
        await session.runtime_enable()
        _trace("runtime_evaluate")
        result = await session.runtime_evaluate(expr, return_by_value=return_by_value)
        _trace("done")
        return result
    finally:
        await inspector.close()


# ---------- subcommands ---------- #

async def cmd_eval(expr: str) -> None:
    result = await eval_js(expr)
    _print_json(result)


async def cmd_scroll(selector: str, dy: int, smooth: bool = False) -> None:
    behavior = "smooth" if smooth else "instant"
    if selector in ("window", "document", "html"):
        expr = f"(()=>{{ window.scrollBy({{top:{dy},behavior:'{behavior}'}}); return {{ scrollY: window.scrollY }} }})()"
    else:
        safe = json.dumps(selector)
        expr = (
            "(()=>{"
            f"const el=document.querySelector({safe});"
            "if(!el) return {error:'no match'};"
            f"el.scrollBy({{top:{dy},behavior:'{behavior}'}});"
            "return {scrollTop:el.scrollTop};}"
            ")()"
        )
    _print_json(await eval_js(expr))


async def cmd_click(selector: str) -> None:
    safe = json.dumps(selector)
    expr = (
        "(()=>{"
        f"const el=document.querySelector({safe});"
        "if(!el) return {error:'no match'};"
        "el.click();"
        "return {clicked:true};}"
        ")()"
    )
    _print_json(await eval_js(expr))


async def cmd_rect(selector: str) -> None:
    safe = json.dumps(selector)
    expr = (
        "(()=>{"
        f"const el=document.querySelector({safe});"
        "if(!el) return {error:'no match'};"
        "const r=el.getBoundingClientRect();"
        "return {x:r.x,y:r.y,width:r.width,height:r.height,"
        "scrollTop:el.scrollTop,scrollHeight:el.scrollHeight,"
        "clientHeight:el.clientHeight};}"
        ")()"
    )
    _print_json(await eval_js(expr))


async def cmd_dom(selector: str) -> None:
    safe = json.dumps(selector)
    expr = (
        "(()=>{"
        f"const el=document.querySelector({safe});"
        "if(!el) return {error:'no match'};"
        "const r=el.getBoundingClientRect();"
        "return {html:el.outerHTML,rect:{x:r.x,y:r.y,width:r.width,height:r.height}};}"
        ")()"
    )
    _print_json(await eval_js(expr))


async def cmd_pages() -> None:
    udid = os.environ.get("CORPAN_IPAD_UDID", "")
    rsd = await _tunneld(udid)
    if rsd is None:
        raise SystemExit("no tunneld-connected device.")
    inspector = WebinspectorService(lockdown=rsd)
    await inspector.connect(DEFAULT_TIMEOUT)
    try:
        pages = await inspector.get_open_application_pages(timeout=DEFAULT_TIMEOUT)
        for p in pages:
            print(f"{p.application.bundle}\t{p.page.web_url}\t{p.page.type_}")
    finally:
        await inspector.close()


# ---------- plumbing ---------- #

def _print_json(value: Any) -> None:
    try:
        print(json.dumps(value, ensure_ascii=False))
    except (TypeError, ValueError):
        print(repr(value))


def _usage() -> int:
    print(__doc__.strip(), file=sys.stderr)
    return 2


async def _main(argv: list[str]) -> int:
    if not argv:
        return _usage()
    cmd, *rest = argv

    if cmd == "eval" and len(rest) == 1:
        await cmd_eval(rest[0])
    elif cmd == "scroll" and len(rest) >= 2:
        smooth = "--smooth" in rest
        rest = [a for a in rest if a != "--smooth"]
        await cmd_scroll(rest[0], int(rest[1]), smooth=smooth)
    elif cmd == "click" and len(rest) == 1:
        await cmd_click(rest[0])
    elif cmd == "rect" and len(rest) == 1:
        await cmd_rect(rest[0])
    elif cmd == "dom" and len(rest) == 1:
        await cmd_dom(rest[0])
    elif cmd == "pages" and not rest:
        await cmd_pages()
    else:
        return _usage()
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(_main(sys.argv[1:])))
