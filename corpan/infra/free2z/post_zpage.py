#!/usr/bin/env python3
"""Create or update a Free2z zPage from a Markdown file.

Free2z is where we post a public marketing/announcement page for each big
release (and whenever we ship new videos). See README.md in this directory for
the Free2z-flavored Markdown (F2ZM) reference and the release workflow.

Auth: a Knox API token for the `corpora` account. NEVER hardcode it. Export it:

    export FREE2Z_TOKEN=...        # the corpora account's Knox API token

Create a page:

    python post_zpage.py \
        --content catch-up-2026-06.md \
        --title "Corpán — pure learning, fully offline" \
        --description "<=255 char meta description>" \
        --category EDUCATION \
        --tags "Corpán,language learning,offline,privacy,on-device AI,education" \
        --vanity corpan-pure-learning-2026 \
        --publish

Update an existing page (edit copy / swap videos) — pass its free2zaddr or vanity:

    python post_zpage.py --update corpan-pure-learning-2026 --content catch-up-2026-06.md --publish

Omit --publish to leave it as a draft (is_published=false) for review first.
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request

BASE = "https://free2z.com"

# Valid category values from the OpenAPI schema (components.schemas.CategoryEnum).
CATEGORIES = {
    "", "ART", "COMEDY", "COMMUNITY", "CHARITY", "CRYPTO", "EDUCATION",
    "FICTION", "FOR TRADE", "FREE2Z", "FUNDRAISING", "GAMING", "HEALTH",
    "LIFESTYLE", "MATH", "MUSIC", "PODCAST", "POLITICS", "RELIEF", "SCIENCE",
    "SERVICE", "SPORTS", "TECHNOLOGY", "ZCASH",
}


def request(method, path, token, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        BASE + path,
        data=data,
        headers={
            "Authorization": f"Token {token}",
            "Content-Type": "application/json",
        },
        method=method,
    )
    try:
        with urllib.request.urlopen(req) as r:
            body = r.read().decode()
            return r.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        # Noisy, not silent: surface the server's validation errors.
        sys.stderr.write(f"HTTP {e.code} on {method} {path}\n{e.read().decode()}\n")
        raise SystemExit(1)


def resolve_addr(ident, token):
    """Accept either a free2zaddr (UUID) or a vanity slug; return the free2zaddr."""
    if "-" in ident and len(ident) == 36 and ident.count("-") == 4:
        return ident  # looks like a UUID free2zaddr
    # Treat as vanity: the detail endpoint accepts the vanity too, but be explicit.
    _, page = request("GET", f"/api/zpage/{ident}/", token)
    return page["free2zaddr"]


def main():
    ap = argparse.ArgumentParser(description="Create/update a Free2z zPage from Markdown.")
    ap.add_argument("--content", required=True, help="path to the Markdown (F2ZM) file")
    ap.add_argument("--title", help="page title (<=128 chars); required on create")
    ap.add_argument("--description", default="", help="meta description (<=255 chars)")
    ap.add_argument("--category", default="EDUCATION", choices=sorted(CATEGORIES))
    ap.add_argument("--tags", default="", help="comma-separated tags")
    ap.add_argument("--vanity", help="vanity slug ([-a-zA-Z0-9_]+); set once on create")
    ap.add_argument("--publish", action="store_true", help="publish (default: draft)")
    ap.add_argument("--subscriber-only", action="store_true")
    ap.add_argument("--update", metavar="ADDR_OR_VANITY",
                    help="update an existing page instead of creating one")
    args = ap.parse_args()

    token = os.environ.get("FREE2Z_TOKEN")
    if not token:
        sys.exit("FREE2Z_TOKEN is not set. export FREE2Z_TOKEN=<corpora knox token>")

    content = open(args.content, encoding="utf-8").read()
    payload = {
        "content": content,
        "category": args.category,
        "is_published": bool(args.publish),
        "is_subscriber_only": bool(args.subscriber_only),
    }
    if args.title:
        payload["title"] = args.title
    if args.description:
        payload["description"] = args.description
    if args.tags:
        payload["tags"] = [t.strip() for t in args.tags.split(",") if t.strip()]
    if args.vanity:
        payload["vanity"] = args.vanity

    if args.update:
        addr = resolve_addr(args.update, token)
        status, page = request("PATCH", f"/api/zpage/{addr}/", token, payload)
    else:
        if not args.title:
            sys.exit("--title is required when creating a page")
        status, page = request("POST", "/api/zpage/", token, payload)

    print(f"OK ({status})")
    print(f"  title:     {page.get('title')}")
    print(f"  published: {page.get('is_published')}")
    print(f"  url:       {BASE}{page.get('get_url')}")
    print(f"  addr:      {page.get('free2zaddr')}")


if __name__ == "__main__":
    main()
