#!/usr/bin/env python3
"""CDP device harness for on-device integration testing of the Corpán Android app.

A thin, dependency-light wrapper over the Chrome DevTools Protocol exposed by the
Tauri WebView. Reuses ONE websocket connection across calls (fast), and offers the
primitives an integration suite needs: evaluate JS, screenshot, reload, wait-until,
and tap-an-element-by-visible-text (drives the real UI, not a mock).

Requires: a connected, debuggable device running the app; `websocket-client`.
"""
import json
import re
import subprocess
import sys
import time
import urllib.request

import websocket  # websocket-client


def _socket_name() -> str:
    out = subprocess.check_output(["adb", "shell", "cat", "/proc/net/unix"], text=True)
    names = sorted(set(re.findall(r"@?(webview_devtools_remote_\d+)", out)))
    if not names:
        raise RuntimeError("no webview devtools socket (app not running / not debuggable)")
    return names[-1]


def _page_ws(port: int) -> str:
    subprocess.run(
        ["adb", "forward", f"tcp:{port}", f"localabstract:{_socket_name()}"],
        check=True, capture_output=True,
    )
    data = json.load(urllib.request.urlopen(f"http://localhost:{port}/json", timeout=8))
    pages = [p for p in data if p.get("type") == "page" and "webSocketDebuggerUrl" in p]
    if not pages:
        pages = [p for p in data if "webSocketDebuggerUrl" in p]
    if not pages:
        raise RuntimeError("no inspectable page")
    return pages[0]["webSocketDebuggerUrl"]


class Device:
    def __init__(self, port: int = 9222):
        self.port = port
        self._id = 0
        self.ws = None
        self.connect()

    def connect(self):
        if self.ws:
            try:
                self.ws.close()
            except Exception:
                pass
        self.ws = websocket.create_connection(
            _page_ws(self.port), timeout=20, max_size=None, suppress_origin=True
        )

    def _cmd(self, method: str, params: dict | None = None, retries: int = 1):
        self._id += 1
        mid = self._id
        try:
            self.ws.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
            while True:
                msg = json.loads(self.ws.recv())
                if msg.get("id") == mid:
                    if "error" in msg:
                        raise RuntimeError(msg["error"])
                    return msg.get("result", {})
        except Exception:
            if retries > 0:
                time.sleep(1.0)
                self.connect()
                return self._cmd(method, params, retries - 1)
            raise

    def ev(self, expr: str):
        """Evaluate a JS expression; await promises; return the value (or {'__error':...})."""
        res = self._cmd("Runtime.evaluate", {
            "expression": expr, "returnByValue": True, "awaitPromise": True,
        }).get("result", {})
        rr = res.get("result", res)
        if "exceptionDetails" in res:
            return {"__error": str(res["exceptionDetails"].get("text"))}
        return rr.get("value")

    def reload(self):
        self._cmd("Page.enable")
        self._cmd("Page.reload", {"ignoreCache": True})

    def screenshot(self, path: str):
        import base64
        res = self._cmd("Page.captureScreenshot", {"format": "png"})
        data = res.get("data")
        if not data:
            return False
        with open(path, "wb") as f:
            f.write(base64.b64decode(data))
        return True

    def wait_until(self, js_bool_expr: str, timeout: float = 15.0, interval: float = 0.4) -> bool:
        """Poll a JS expression that returns a boolean until true or timeout."""
        end = time.time() + timeout
        while time.time() < end:
            try:
                if self.ev(f"!!({js_bool_expr})") is True:
                    return True
            except Exception:
                self.connect()
            time.sleep(interval)
        return False

    def url(self) -> str:
        return self.ev("location.href")

    def text(self, limit: int = 4000) -> str:
        return self.ev(f'(document.body.innerText||"").slice(0,{limit})') or ""

    def tap_text(self, text: str, exact: bool = False, role: str | None = None) -> bool:
        """Click the first visible element whose trimmed text matches `text`.
        Prefers buttons/links/[role=button]. Returns True if clicked."""
        js = """
        (() => {
          const want = %s; const exact = %s; const role = %s;
          const norm = (s) => (s||"").replace(/\\s+/g," ").trim();
          const vis = (el) => { const r = el.getBoundingClientRect(); const st = getComputedStyle(el);
            return r.width>0 && r.height>0 && st.visibility!=="hidden" && st.display!=="none" && st.pointerEvents!=="none"; };
          const sel = role ? `[role="${role}"]` : "button, a, [role=button], [role=option], label, .cursor-pointer";
          const cands = Array.from(document.querySelectorAll(sel)).filter(vis);
          let hit = cands.find((el) => { const t = norm(el.innerText); return exact ? t===want : t.includes(want); });
          if (!hit) {
            // fall back to any element directly containing the text
            const all = Array.from(document.querySelectorAll("*")).filter(vis);
            hit = all.reverse().find((el)=>{ const own = norm(Array.from(el.childNodes).filter(n=>n.nodeType===3).map(n=>n.textContent).join("")); return exact ? own===want : own.includes(want); });
          }
          if (!hit) return false;
          hit.scrollIntoView({block:"center"});
          hit.click();
          return true;
        })()
        """ % (json.dumps(text), json.dumps(exact), json.dumps(role))
        return self.ev(js) is True

    def tap_selector(self, selector: str, index: int = 0) -> bool:
        js = f"""(() => {{ const els=document.querySelectorAll({json.dumps(selector)}); const el=els[{index}]; if(!el) return false; el.scrollIntoView({{block:'center'}}); el.click(); return true; }})()"""
        return self.ev(js) is True


if __name__ == "__main__":
    d = Device()
    print("url:", d.url())
    print(json.dumps(d.ev(sys.argv[1] if len(sys.argv) > 1 else "document.title"), indent=2, ensure_ascii=False))
