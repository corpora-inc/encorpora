#!/usr/bin/env python3
import argparse
import base64
import json
import os
import sys
import urllib.request


def _post_json(url, api_key, payload):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8", errors="replace")
        print(body, file=sys.stderr)
        raise


def main():
    parser = argparse.ArgumentParser(
        description="Generate an image using the OpenAI Images API."
    )
    parser.add_argument("--prompt", help="Text prompt for the image.")
    parser.add_argument(
        "--prompt-file",
        help="Path to a file containing the prompt.",
    )
    parser.add_argument(
        "--out",
        required=True,
        help="Output PNG path.",
    )
    parser.add_argument(
        "--model",
        default="gpt-image-1",
        help="Image model (default: gpt-image-1).",
    )
    parser.add_argument(
        "--size",
        default="1024x1024",
        help="Image size (default: 1024x1024).",
    )
    parser.add_argument(
        "--quality",
        help="Optional quality parameter, if supported by the model.",
    )
    parser.add_argument(
        "--endpoint",
        default="https://api.openai.com/v1/images/generations",
        help="OpenAI Images endpoint.",
    )
    args = parser.parse_args()

    prompt = args.prompt
    if args.prompt_file:
        prompt = open(args.prompt_file, "r", encoding="utf-8").read().strip()
    if not prompt:
        sys.exit("Provide --prompt or --prompt-file.")

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        sys.exit("Set OPENAI_API_KEY in your environment.")

    payload = {
        "model": args.model,
        "prompt": prompt,
        "size": args.size,
        "n": 1,
    }
    if args.quality:
        payload["quality"] = args.quality

    data = _post_json(args.endpoint, api_key, payload)
    item = data["data"][0]
    if "b64_json" in item:
        img_bytes = base64.b64decode(item["b64_json"])
    elif "url" in item:
        with urllib.request.urlopen(item["url"]) as resp:
            img_bytes = resp.read()
    else:
        sys.exit(f"Unexpected response format: {item}")

    out_dir = os.path.dirname(os.path.abspath(args.out))
    os.makedirs(out_dir, exist_ok=True)
    with open(args.out, "wb") as f:
        f.write(img_bytes)

    print(f"Wrote {args.out}")


if __name__ == "__main__":
    main()
