#!/usr/bin/env python3
"""Static file server with permissive CORS for the corpan dev loop.

In dev the pack is served from this server (http://<ip>:8989/...), which is a
DIFFERENT origin than the webview the pack runs in — so a Web-Audio `fetch()` of
the pack's own WAVs is a cross-origin request and is blocked without CORS headers.
This serves the current working directory exactly like `python -m http.server`,
but adds `Access-Control-Allow-Origin: *` so those fetches work. When the pack is
INSTALLED, it's served same-origin via the `corpan-pack://` scheme and needs none
of this.

Usage: python3 cors-server.py [port] [bind]   (defaults: 8989 0.0.0.0)
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        super().end_headers()

    def do_OPTIONS(self):  # noqa: N802 (stdlib naming)
        self.send_response(204)
        self.end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8989
    bind = sys.argv[2] if len(sys.argv) > 2 else "0.0.0.0"
    httpd = ThreadingHTTPServer((bind, port), CORSRequestHandler)
    print(f"[cors-server] serving {sys.argv[0]} cwd on {bind}:{port} with CORS")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
