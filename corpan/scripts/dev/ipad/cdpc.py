#!/usr/bin/env python3
"""
Fast client for the cdpd.py daemon. Stdlib-only (no pymobiledevice3 import), so
it starts instantly with the system python. Sends one JS eval to the persistent
daemon over its Unix socket and prints the result EXACTLY like ipad_cdp's
`_print_json` — a drop-in for `cdp.sh eval EXPR`.

  python3 cdpc.py "(()=>document.title)()"

Exit 3 + {"error":"cdpd not running"} when the daemon is down, so callers can
fall back to the per-call path.
"""
import json
import os
import socket
import sys

SOCK = os.environ.get("CDPD_SOCK", "/tmp/corpan-cdpd.sock")


def main() -> int:
    expr = sys.argv[1] if len(sys.argv) > 1 else ""
    try:
        s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        s.settimeout(float(os.environ.get("CDPC_TIMEOUT", "20")))
        s.connect(SOCK)
    except OSError:
        print(json.dumps({"error": "cdpd not running"}))
        return 3
    try:
        s.sendall((json.dumps({"expr": expr}) + "\n").encode())
        buf = b""
        while not buf.endswith(b"\n"):
            chunk = s.recv(65536)
            if not chunk:
                break
            buf += chunk
    except OSError as e:
        print(json.dumps({"error": f"socket: {e}"}))
        return 1
    resp = json.loads(buf.decode())
    if resp.get("ok"):
        print(json.dumps(resp["value"], ensure_ascii=False))
        return 0
    print(json.dumps({"error": resp.get("error")}))
    return 1


if __name__ == "__main__":
    sys.exit(main())
