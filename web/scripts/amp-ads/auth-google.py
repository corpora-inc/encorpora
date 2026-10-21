"""Authorize a separate Google Ads token without exposing tokens in logs."""

import argparse
import os
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from google_auth_oauthlib.flow import InstalledAppFlow

p = argparse.ArgumentParser()
p.add_argument("--client", required=True)
p.add_argument("--output", required=True)
p.add_argument("--port", type=int, default=8769)
a = p.parse_args()
output = Path(a.output).expanduser()
if output.exists():
    raise SystemExit(
        "Refusing to overwrite existing credentials; choose a new output path."
    )
flow = InstalledAppFlow.from_client_secrets_file(
    a.client,
    scopes=["https://www.googleapis.com/auth/adwords"],
    autogenerate_code_verifier=True,
)
flow.redirect_uri = f"http://127.0.0.1:{a.port}/callback"
url, state = flow.authorization_url(access_type="offline", prompt="consent")


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        path = urlparse(self.path)
        if path.path == "/login":
            self.send_response(302)
            self.send_header("Location", url)
            self.end_headers()
            return
        if path.path != "/callback":
            self.send_error(404)
            return
        q = parse_qs(path.query)
        if q.get("state", [""])[0] != state or not q.get("code"):
            self.send_error(400, "Invalid authorization response")
            return
        try:
            flow.fetch_token(code=q["code"][0])
            output.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            fd = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, "w") as f:
                f.write(flow.credentials.to_json())
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"Google Ads authorization saved. You can close this tab.")
            print("Google Ads authorization saved securely.", flush=True)
            threading.Thread(target=self.server.shutdown).start()
        except Exception:  # noqa: BLE001 -- never expose OAuth credential responses
            self.send_error(500, "Authorization could not be saved")
            print("Authorization failed; no credential values logged.", flush=True)


server = HTTPServer(("127.0.0.1", a.port), Handler)
print(f"Open http://127.0.0.1:{a.port}/login in the authorized browser.", flush=True)
server.serve_forever()
