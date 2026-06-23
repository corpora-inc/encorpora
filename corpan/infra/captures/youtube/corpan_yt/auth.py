"""OAuth installed-app flow against Google Cloud client_secret.json.

First run opens a browser; user consents to the Google account that owns
@corpán1. Refresh token is cached at ~/.config/corpora/youtube/token.json
and refreshed automatically on subsequent runs.

While the OAuth consent screen is in *Testing* mode, refresh tokens expire
after 7 days — re-run `corpan-yt auth` to consent again. Once the consent
screen is pushed to Production (may need verification for sensitive scopes),
tokens persist indefinitely.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.force-ssl",
    "https://www.googleapis.com/auth/youtube.readonly",
]

CONFIG_DIR = Path(os.environ.get("CORPAN_YT_CONFIG_DIR", Path.home() / ".config" / "corpora" / "youtube"))
CLIENT_SECRET_PATH = CONFIG_DIR / "client_secret.json"
TOKEN_PATH = CONFIG_DIR / "token.json"


def _die(msg: str) -> None:
    print(f"corpan-yt: {msg}", file=sys.stderr)
    sys.exit(2)


def get_credentials(*, force_reauth: bool = False) -> Credentials:
    """Return valid Credentials, running OAuth flow if necessary.

    On `force_reauth=True`, discard any cached token and re-consent in the
    browser. Useful when scopes change or when a refresh token expires
    inside the 7-day Testing window.
    """
    if not CLIENT_SECRET_PATH.exists():
        _die(
            f"client_secret.json missing at {CLIENT_SECRET_PATH}\n"
            f"  Download the OAuth client (type=Desktop) from Google Cloud Console\n"
            f"  and save it as that exact filename. Then re-run."
        )

    creds: Credentials | None = None
    if TOKEN_PATH.exists() and not force_reauth:
        try:
            creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)
        except Exception as e:
            print(f"corpan-yt: cached token unreadable ({e}); re-authing", file=sys.stderr)
            creds = None

    if creds and creds.valid:
        return creds

    if creds and creds.expired and creds.refresh_token and not force_reauth:
        try:
            creds.refresh(Request())
            TOKEN_PATH.write_text(creds.to_json())
            return creds
        except Exception as e:
            print(f"corpan-yt: refresh failed ({e}); re-running consent", file=sys.stderr)

    flow = InstalledAppFlow.from_client_secrets_file(str(CLIENT_SECRET_PATH), SCOPES)
    # `select_account` forces Google to show the account chooser instead of
    # silently using whichever account the browser is already signed in to.
    # `consent` then forces the consent screen on top of that. Without
    # select_account, `--force` re-consents to the same account every time.
    creds = flow.run_local_server(port=0, open_browser=True, prompt="select_account consent")
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    TOKEN_PATH.write_text(creds.to_json())
    TOKEN_PATH.chmod(0o600)
    print(f"corpan-yt: token cached at {TOKEN_PATH}", file=sys.stderr)
    return creds
